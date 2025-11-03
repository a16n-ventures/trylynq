import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface Contact {
  name: string;
  phone?: string;
  email?: string;
}

export const useContactImport = () => {
  const [importing, setImporting] = useState(false);
  const { user } = useAuth();

  const importContacts = async (contacts: Contact[]) => {
    if (!user) { 
      toast.error('Please sign in to import contacts');
      return; 
    }

    setImporting(true);
    try {
      // Import contacts to database
      const contactsToInsert = contacts.map(contact => ({
        user_id: user.id,
        contact_name: contact.name,
        contact_phone: contact.phone,
        contact_email: contact.email,
      }));

      const { error } = await supabase
        .from('contacts')
        .insert(contactsToInsert);

      if (error) throw error;

      toast.success(`Imported ${contacts.length} contacts`);
      
      // Trigger friend matching
      await matchContacts();
    } catch (err: any) {
      console.error('Error importing contacts:', err);
      toast.error(`Failed to import contacts: ${err?.message || 'Unknown error'}`);
    }
    } finally {
      setImporting(false);
    }
  };

  const matchContacts = async () => {
    // This would typically be an edge function that matches contacts
    // with existing users and sends friend requests
    toast.info('Looking for friends...');
  };

  const requestContactAccess = async () => {
    try {
      // For web, we'll use a simpler approach with manual import
      // In a real mobile app, you'd use Capacitor's Contacts plugin
      toast.info('Contact import feature - upload your contacts file or add friends manually');
      return true;
    } catch (err) {
      toast.error('Contact access denied');
      return false;
    }
  };

  return {
    importContacts,
    requestContactAccess,
    importing,
  };
};
