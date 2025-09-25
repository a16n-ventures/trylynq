import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Dashboard from "./pages/Dashboard";
import Map from "./pages/Map";
import Messages from "./pages/Messages";
import Friends from "./pages/Friends";
import Profile from "./pages/Profile";
import CreateEvent from "./pages/CreateEvent";
import SocialFeed from "./pages/SocialFeed";
import Premium from "./pages/Premium";
import SearchAndFilter from "./components/features/SearchAndFilter";
import MainLayout from "./components/layout/MainLayout";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/app" element={<MainLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="map" element={<Map />} />
            <Route path="messages" element={<Messages />} />
            <Route path="friends" element={<Friends />} />
            <Route path="profile" element={<Profile />} />
            <Route path="feed" element={<SocialFeed />} />
            <Route path="search" element={<SearchAndFilter />} />
          </Route>
          <Route path="/create-event" element={<CreateEvent />} />
          <Route path="/premium" element={<Premium />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
