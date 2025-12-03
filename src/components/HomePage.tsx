import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import "./HomePage.css";
import logo from "../assets/ibadan_north.png";
import pic1 from "../assets/pic11.jpg";
import pic2 from "../assets/pic111.jpg";
import pic3 from "../assets/pic1.jpg";
import pic4 from "../assets/pic1111.jpg";
import pic5 from "../assets/pic11111.jpg";

const HomePage: React.FC = () => {
  const images = [pic1, pic2, pic3, pic4, pic5];
  const [current, setCurrent] = useState(0);

  // Auto change slides every 5 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % images.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [images.length]);

  const nextSlide = () => setCurrent((prev) => (prev + 1) % images.length);
  const prevSlide = () =>
    setCurrent((prev) => (prev - 1 + images.length) % images.length);

  return (
    <div className="home-container">
      {/* Background video */}
      <video autoPlay muted loop className="background-video">
        <source src="/background.mp4" type="video/mp4" />
        Your browser does not support the video tag.
      </video>

      {/* Navbar */}
      <header className="navbar">
        <div className="navbar-left">
          <img src={logo} alt="Logo" className="logo" />
          <h1>Diocesan Youth Organization</h1>
        </div>
        <nav className="navbar-links">
          <Link to="/">Home</Link>
          <Link to="/register">Register</Link>
          <Link to="/donate">Donation</Link>
        </nav>
      </header>

      {/* Carousel */}
      <main className="main-content">
        <div className="carousel">
          {images.map((img, index) => (
            <img
              key={index}
              src={img}
              alt={`Youth activity ${index + 1}`}
              className={`carousel-image ${
                index === current ? "active" : ""
              }`}
            />
          ))}

          {/* Overlay text */}
          <div className="carousel-overlay">
            <h2>Welcome to the Diocesan Youth Convention 2025</h2>
          </div>

          {/* Navigation arrows */}
          <button className="arrow left" onClick={prevSlide}>
            &#10094;
          </button>
          <button className="arrow right" onClick={nextSlide}>
            &#10095;
          </button>
        </div>
      </main>

      {/* Footer */}
      <footer className="footer">
        <p>
          © {new Date().getFullYear()} Diocesan Youth Organization. All rights
          reserved.
        </p>
      </footer>
    </div>
  );
};

export default HomePage;
