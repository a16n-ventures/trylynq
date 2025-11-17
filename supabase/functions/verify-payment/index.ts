
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js";
// WARNING: This is a DANGEROUS client.
// It has service_role privileges and can bypass RLS.
// NEVER expose this to the client.
const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
// Get the Flutterwave Secret Key from your Edge Function's secrets
// In Supabase Studio: Project > Settings > Functions > Secrets
// Add a new secret: FLUTTERWAVE_SECRET_KEY
const FLUTTERWAVE_SECRET_KEY = Deno.env.get('FLUTTERWAVE_SECRET_KEY');
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
serve(async (req)=>{
  // Handle preflight OPTIONS request for CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  try {
    // 1. Get user and request body
    const { tx_ref, expected_amount, expected_currency } = await req.json();
    // Get the user's JWT from the request header
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing Authorization header');
    const token = authHeader.replace(/^Bearer\s+/i, '');
    const { data: { user }, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr) throw userErr;
    if (!user) {
      throw new Error('User not authenticated');
    }
    if (!FLUTTERWAVE_SECRET_KEY) {
      throw new Error('Payment processor not configured on server.');
    }
    // 2. Call Flutterwave to verify the transaction
    const verificationUrl = `https://api.flutterwave.com/v3/transactions/verify_by_tx_ref?tx_ref=${encodeURIComponent(tx_ref)}`;
    const response = await fetch(verificationUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${FLUTTERWAVE_SECRET_KEY}`
      }
    });
    if (!response.ok) {
      throw new Error('Failed to fetch transaction status from Flutterwave');
    }
    const paymentData = await response.json();
    // 3. CRITICAL: Verify payment details
    if (paymentData.status === 'success' && paymentData.data?.status === 'successful' && Number(paymentData.data?.amount) === Number(expected_amount) && String(paymentData.data?.currency) === String(expected_currency)) {
      // 4. Payment is valid! Grant premium access.
      // We use the admin client to bypass RLS.
      const { error: updateError } = await supabaseAdmin.from('profiles') // Assuming this is your table
      .update({
        is_premium: true,
        premium_tier: 'full_package',
        updated_at: new Date().toISOString()
      }).eq('user_id', user.id);
      if (updateError) {
        throw new Error(`Failed to update user profile: ${updateError.message}`);
      }
      // 5. Return success to the client
      return new Response(JSON.stringify({
        status: 'success',
        message: 'Premium activated'
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    } else {
      // 4. Payment is invalid or failed
      throw new Error(`Payment verification failed. Status: ${paymentData.data?.status ?? paymentData.status}`);
    }
  } catch (error) {
    // 5. Return error to the client
    return new Response(JSON.stringify({
      status: 'error',
      message: error.message || String(error)
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 400
    });
  }
});
