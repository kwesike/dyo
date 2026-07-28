import { BrowserRouter as Router, Routes, Route, NavLink, Navigate } from "react-router-dom";

import { AuthProvider } from "./components/Authcontext";
import { CartProvider } from "./components/Cartcontext";
import { RequireAdmin, RequireAuth, RequireSection } from "./components/Routeguards";

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
import GalleryPage from "./components/Gallerypage";
import BlogPage from "./components/Blogpage";
import BlogPost from "./components/Blogpost";
import ArchdeaconryPage from "./components/Archdeaconrypage";
import SitePage from "./components/Sitepage";
import ProgrammesPage from "./components/Programmepage";
import ProgrammeDetail from "./components/Programmedetail";

/* ---------- store ---------- */
import StorePage from "./components/Storepage";
import ProductDetail from "./components/Productdetail";
import CheckoutPage from "./components/Checkoutpage";
import OrderReceipt from "./components/Orderreceipt";

/* ---------- admin ---------- */
import AdminLayout from "./components/Adminlayout";
import AdminDonations from "./components/Admindonation";
import AdminAudit from "./components/Adminaudit";
import AdminHome from "./components/Adminhome";
import AdminProgrammes from "./components/Adminprogrammes";
import AdminRegistrations from "./components/Adminregistrations";
import AdminRegistrationsIndex from "./components/Adminregistrationindex";
import AdminProducts from "./components/Adminproducts";
import AdminOrders from "./components/Adminorders";
import AdminAnnouncements from "./components/Adminannouncements";
import AdminReceipts from "./components/Adminreceipts";
import AdminLeadership from "./components/Adminleadership";
import AdminCarousel from "./components/Admincarousel";
import AdminGallery from "./components/Admingallery";
import AdminBlog from "./components/Adminblog";
import AdminAccess from "./components/Adminaccess";
import MyArchdeaconry from "./components/Myarchdeaconry";
import AdminPages from "./components/Adminpages";
import AdminMembers from "./components/Adminmembers";
import AdminDashboard from "./components/AdminDashboard";
import VoucherGenerator from "./components/VoucherGenerator";
import AdminTags from "./components/AdminTags";
import SponsorshipReceipt from "./components/Sponsorshipreceipt";
import BodyPayment from "./components/Bodypayment";
import BodyReceipt from "./components/Bodyreceipt";

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

            {/* ============ GALLERY & BLOG ============ */}
            <Route path="/gallery" element={<GalleryPage />} />
            <Route path="/blog" element={<BlogPage />} />
            <Route path="/blog/:slug" element={<BlogPost />} />
            <Route path="/archdeaconry/:slug" element={<ArchdeaconryPage />} />
            <Route path="/p/:slug" element={<SitePage />} />

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
            <Route path="/sponsorship/:id" element={<SponsorshipReceipt />} />
            <Route path="/programmes/:slug/body-payment" element={<BodyPayment />} />
            <Route path="/body-receipt/:id" element={<BodyReceipt />} />

            {/* ============ ADMIN ============ */}
            <Route path="/admin" element={<RequireAdmin><AdminLayout /></RequireAdmin>}>
              <Route index element={<AdminHome />} />

              <Route path="programmes" element={<RequireSection section="programmes"><AdminProgrammes /></RequireSection>} />
              <Route path="programmes/:id/registrations" element={<RequireSection section="registrations"><AdminRegistrations /></RequireSection>} />
              <Route path="registrations" element={<RequireSection section="registrations"><AdminRegistrationsIndex /></RequireSection>} />
              <Route path="vouchers" element={<VoucherGenerator />} />
              <Route path="tags" element={<AdminTags />} />

              <Route path="products" element={<RequireSection section="store"><AdminProducts /></RequireSection>} />
              <Route path="orders" element={<RequireSection section="orders"><AdminOrders /></RequireSection>} />

              <Route path="carousel" element={<RequireSection section="carousel"><AdminCarousel /></RequireSection>} />
              <Route path="announcements" element={<RequireSection section="announcements"><AdminAnnouncements /></RequireSection>} />
              <Route path="gallery" element={<RequireSection section="gallery"><AdminGallery /></RequireSection>} />
              <Route path="blog" element={<RequireSection section="blog"><AdminBlog /></RequireSection>} />
              <Route path="leadership" element={<RequireSection section="leadership"><AdminLeadership /></RequireSection>} />
              <Route path="audit" element={<RequireSection section="audit"><AdminAudit /></RequireSection>} />
              <Route path="donations" element={<RequireSection section="donations"><AdminDonations /></RequireSection>} />
              <Route path="receipts" element={<RequireSection section="receipts"><AdminReceipts /></RequireSection>} />

              <Route path="members" element={<RequireSection section="members"><AdminMembers /></RequireSection>} />
              <Route path="access" element={<AdminAccess />} />
              <Route path="my-archdeaconry" element={<MyArchdeaconry />} />
              <Route path="pages" element={<RequireSection section="pages"><AdminPages /></RequireSection>} />
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