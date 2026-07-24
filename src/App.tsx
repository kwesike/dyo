import { BrowserRouter as Router, Routes, Route, NavLink, Navigate } from "react-router-dom";

import { AuthProvider } from "./Authcontext";
import { CartProvider } from "./Cartcontext";
import { RequireAdmin, RequireAuth } from "./components/Routeguards";

/* ---------- public pages ---------- */
import HomePage from "./components/HomePage";
import DonationPage from "./components/DonationPage";
import PaymentPage from "./components/PaymentPage";
import SuccessPage from "./components/SuccessPage";
import SuccessDonation from "./components/SuccessDonation";
import MissionVoluteer from "./components/MissionVoluteer";
import Ignition from "./components/Ignition";

/* ---------- accounts ---------- */
import Login from "./components/Login";
import Signup from "./components/Signup";
import CheckYourEmail from "./components/Checkyouremail";
import AccountPage from "./components/Accountpage";

/* ---------- programmes ---------- */
import ProgrammesPage from "./components/Programmepage";
import ProgrammeDetail from "./components/Programmedetail";

/* ---------- store ---------- */
import StorePage from "./components/Storepage";
import ProductDetail from "./components/Productdetail";
import CheckoutPage from "./components/Checkoutpage";
import OrderReceipt from "./components/Orderreceipt";

/* ---------- admin ---------- */
import AdminLayout from "./components/Adminlayout";
import AdminHome from "./components/Adminhome";
import AdminProgrammes from "./components/Adminprogrammes";
import AdminRegistrations from "./components/Adminregistrations";
import AdminRegistrationsIndex from "./components/Adminregistrationsindex";
import AdminProducts from "./components/Adminproducts";
import AdminOrders from "./components/Adminorders";
import AdminAnnouncements from "./components/Adminannouncements";
import AdminLeadership from "./components/Adminleadership";
import AdminMembers from "./components/Adminmembers";
import AdminDashboard from "./components/AdminDashboard";
import VoucherGenerator from "./components/VoucherGenerator";
import AdminTags from "./components/AdminTags";

import "./components/Layout.css";

function NotFound() {
  return (
    <div style={{ padding: 60, textAlign: "center" }}>
      <h2>That page doesn't exist</h2>
      <NavLink to="/">Back to the home page</NavLink>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <CartProvider>
          <Routes>
            {/* ============ PUBLIC ============ */}
            <Route path="/" element={<HomePage />} />
            <Route path="/donate" element={<DonationPage />} />
            <Route path="/mission-voluteer" element={<MissionVoluteer />} />

            {/* Ignition is a programme, not a route. Kept alive so shared
                links don't break. Once it exists in /admin/programmes,
                swap this for a redirect to /programmes/<its-slug>. */}
            <Route path="/register" element={<Ignition />} />

            {/* ============ ACCOUNTS ============ */}
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/check-your-email" element={<CheckYourEmail />} />
            <Route path="/admin-login" element={<Navigate to="/login" replace />} />
            <Route path="/account" element={<RequireAuth><AccountPage /></RequireAuth>} />

            {/* ============ PROGRAMMES ============ */}
            <Route path="/programmes" element={<ProgrammesPage />} />
            <Route path="/programmes/:slug" element={<ProgrammeDetail />} />

            {/* ============ STORE ============ */}
            {/* Browsing stays open — making people sign in to look at a polo
                loses sales. Checkout is where the account matters. */}
            <Route path="/store" element={<StorePage />} />
            <Route path="/store/:slug" element={<ProductDetail />} />
            <Route path="/cart" element={<RequireAuth><CheckoutPage /></RequireAuth>} />
            <Route path="/orders/:id" element={<OrderReceipt />} />

            {/* ============ PAYMENT (legacy flow) ============ */}
            <Route path="/payment/:id" element={<PaymentPage />} />
            <Route path="/success/:id" element={<SuccessPage />} />
            <Route path="/success-donation/:id" element={<SuccessDonation />} />

            {/* ============ ADMIN ============ */}
            <Route path="/admin" element={<RequireAdmin><AdminLayout /></RequireAdmin>}>
              <Route index element={<AdminHome />} />

              <Route path="programmes" element={<AdminProgrammes />} />
              <Route path="programmes/:id/registrations" element={<AdminRegistrations />} />
              <Route path="registrations" element={<AdminRegistrationsIndex />} />
              <Route path="vouchers" element={<VoucherGenerator />} />
              <Route path="tags" element={<AdminTags />} />

              <Route path="products" element={<AdminProducts />} />
              <Route path="orders" element={<AdminOrders />} />

              <Route path="announcements" element={<AdminAnnouncements />} />
              <Route path="leadership" element={<AdminLeadership />} />

              <Route path="members" element={<AdminMembers />} />
              <Route path="legacy" element={<AdminDashboard />} />
            </Route>

            <Route path="/admin-dashboard" element={<Navigate to="/admin/legacy" replace />} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </CartProvider>
      </AuthProvider>
    </Router>
  );
}