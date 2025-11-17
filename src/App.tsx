import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Capture from "./pages/Capture";
import Processing from "./pages/Processing";
import Result from "./pages/Result";
import Showcase from "./pages/Showcase";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import QRGenerator from "./pages/QRGenerator";
import Classes from "./pages/Classes";
import Admin from "./pages/Admin";
import Help from "./pages/Help";
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
          <Route path="/capture" element={<Capture />} />
          <Route path="/processing" element={<Processing />} />
          <Route path="/result" element={<Result />} />
          <Route path="/showcase" element={<Showcase />} />
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/qr-generator" element={<QRGenerator />} />
          <Route path="/classes" element={<Classes />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/help" element={<Help />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
