import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import HomePage from "./components/HomePage";
import RegistrationForm from "./components/RegistrationForm";
import AdminDashboard from "./components/AdminDashboard";
import AdminLogin from "./components/AdminLogin";
import DonationPage from "./components/DonationPage";
import PaymentPage from "./components/PaymentPage";
import SuccessPage from "./components/SuccessPage";
import PaymentComplete from "./components/PaymentComplete";
import VoucherGenerator from "./components/VoucherGenerator";


function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/register" element={<RegistrationForm />} />
        <Route path="/donate" element={<DonationPage />} />
        <Route path="/admin-login" element={<AdminLogin />} />
        <Route path="/admin-dashboard" element={<AdminDashboard />} />
         <Route path="/payment/:id" element={<PaymentPage />} />
        <Route path="/success/:id" element={<SuccessPage />} />
        <Route path="/payment-complete" element={<PaymentComplete />} />
        <Route path="/admin/vouchers" element={<VoucherGenerator />} />


      </Routes>
    </Router>
  );
}

export default App;
