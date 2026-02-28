import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import HomePage from "./components/HomePage";
//import RegistrationForm from "./components/RegistrationForm";
import AdminDashboard from "./components/AdminDashboard";
import AdminLogin from "./components/AdminLogin";
import DonationPage from "./components/DonationPage";
import PaymentPage from "./components/PaymentPage";
import SuccessPage from "./components/SuccessPage";
import SuccessDonation from "./components/SuccessDonation";
import VoucherGenerator from "./components/VoucherGenerator";
import AdminTags from "./components/AdminTags";
import MissionVoluteer from "./components/MissionVoluteer"
import Ignition from "./components/Ignition";



function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/register" element={<Ignition />} />
        <Route path="/donate" element={<DonationPage />} />
        <Route path="/admin-login" element={<AdminLogin />} />
        <Route path="/admin-dashboard" element={<AdminDashboard />} />
         <Route path="/payment/:id" element={<PaymentPage />} />
       <Route path="/success/:id" element={<SuccessPage />} />
        <Route path="/success-donation/:id" element={<SuccessDonation/>} />
        <Route path="/admin/vouchers" element={<VoucherGenerator />} />
        <Route path="/admin/tags" element={<AdminTags />} />
        <Route
  path="/mission-voluteer"
  element={<MissionVoluteer />}
/>



      </Routes>
    </Router>
  );
}

export default App;
