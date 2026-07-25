import { Link } from "react-router-dom";

/** One footer, used by every public page. */
export default function Sitefooter() {
  return (
    <footer className="home-footer">
        <p>© {new Date().getFullYear()} Diocesan Youth Organization. All rights reserved.</p>
        <nav>
          <Link to="/programmes">Programmes</Link>
          <Link to="/store">Store</Link>
          <Link to="/donate">Give</Link>
        </nav>
        <p>nkanuzu kwesi Tech</p>
      </footer>
  );
}