import SiteFooter from './components/SiteFooter';
import SiteHeader from './components/SiteHeader';
import SwimmingFish from "./components/SwimmingFish";
import Register from "./Register";
import PondRegister from "./PondRegister";
import Dashboard from "./Dashboard";
import { useEffect, useState } from "react";
import "./App.css";

const features = [
  {
    number: "01",
    symbol: "≈",
    title: "Pond monitoring",
    description:
      "A dedicated sensor in each pond measures dissolved oxygen, pH, and water temperature through a shared farm gateway.",
    status: "Simulated readings",
  },
  {
    number: "02",
    symbol: "◎",
    title: "Pond-specific guidance",
    description:
      "Guidance brings together your species, stocking density, and available equipment using human-reviewed rules.",
    status: "Reviewed guidance required",
  },
  {
    number: "03",
    symbol: "☁",
    title: "Weather context",
    description:
      "Local rainfall, heat, and wind forecasts add context to changing water conditions in each pond.",
    status: "Powered by Open-Meteo",
  },
  {
    number: "04",
    symbol: "↗",
    title: "SMS alert previews",
    description:
      "Preview localized alerts for the farm operator or a designated farm contact.",
    status: "Simulated messages",
  },
];

function App() {
  const [route, setRoute] = useState(window.location.hash);
  useEffect(() => { if (route === '#register' || route === '#login') window.scrollTo({ top: 0, behavior: 'instant' }); }, [route]);
  useEffect(() => { const update = () => setRoute(window.location.hash); window.addEventListener("hashchange", update); return () => window.removeEventListener("hashchange", update); }, []);
  const [paused, setPaused] = useState(false);
  const [notice, setNotice] = useState("");

  function openAccountNotice(action: string) {
    if (action === "Account registration" || action === "Login") { window.location.hash = action === "Login" ? "login" : "register"; return; }
    setNotice(
      `${action} is coming next. This landing-page preview does not collect account details yet.`,
    );
  }

  if (route === '#dashboard') return <Dashboard />;
  if (route === '#register-pond') return <PondRegister />;
  if (route === "#register" || route === "#login" || window.location.search.includes("code=") || window.location.search.includes("registration=1")) return <Register login={route === "#login"} />;
  return (
    <div className={`site${paused ? " motion-paused" : ""}`}>
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <SiteHeader />

      <main id="main">
        <section className="hero" id="home" aria-labelledby="hero-title">
          <div className="hero-glow" aria-hidden="true" />

          <div className="container hero-grid">
            <div className="hero-copy">
              <p className="eyebrow">
                <span className="small-dot" />
                BUILT FOR COMMERCIAL FISH AND SHRIMP FARMS
              </p>

              <h1 id="hero-title">
                Your pond,
                <br />
                <span>better understood.</span>
              </h1>

              <p className="hero-description">
                Clarity starts in the water. SINAYA brings pond sensor
                readings and local weather forecasts together to help fish
                and shrimp farm teams understand changes and plan their next steps.
              </p>

              <a className="text-link" href="#features">
                Discover what’s inside <span aria-hidden="true">↓</span>
              </a>

              <div className="hero-tags" aria-label="Project focus">
                <span>Water-quality sensors</span>
                <span>Weather context</span>
                <span>Clear alerts</span>
              </div>
            </div>

            <aside className="welcome-card" aria-labelledby="welcome-title">
              <div className="card-topline">
                <span className="eyebrow">YOUR POND COMPANION</span>
                <span className="card-mark" aria-hidden="true">≈</span>
              </div>

              <h2 id="welcome-title">Welcome to Sinaya.</h2>
              <p>
                Get to know each pond’s conditions and keep your farm team
                informed, from the water to the next decision.
              </p>

              <button
                className="button button-primary"
                onClick={() => openAccountNotice("Account registration")}
              >
                Create Account <span aria-hidden="true">↗</span>
              </button>

              <a className="button button-outline" href="#demo">
                Explore Demo <span aria-hidden="true">→</span>
              </a>

              <p className="login-prompt">
                Already registered?{" "}
                <button onClick={() => openAccountNotice("Login")}>
                  Log in
                </button>
              </p>

              <div className="prototype-note">
                Hackathon prototype · Demo readings and SMS previews
              </div>
            </aside>
          </div>

          <div className="water-scene">
            <div className="water-line water-line-one" aria-hidden="true" />
            <div className="water-line water-line-two" aria-hidden="true" />
            <SwimmingFish />
            <span className="water-caption">A little clarity beneath the surface.</span>
            <button
              className="motion-toggle"
              aria-pressed={paused}
              onClick={() => setPaused(!paused)}
            >
              {paused ? "Play animation" : "Pause animation"}
            </button>
          </div>
        </section>

        <section
          className="section container"
          id="features"
          aria-labelledby="features-title"
        >
          <div className="section-heading">
            <div>
              <p className="eyebrow">WHAT’S INSIDE</p>
              <h2 id="features-title">A clearer picture of your pond.</h2>
            </div>
            <p>
              From dissolved oxygen to incoming rain, connect the conditions
              that matter to your farm’s daily decisions.
            </p>
          </div>

          <div className="feature-grid">
            {features.map((feature) => (
              <article className="feature-card" key={feature.number}>
                <div className="feature-top">
                  <span className="feature-icon" aria-hidden="true">
                    {feature.symbol}
                  </span>
                  <span className="feature-number">{feature.number}</span>
                </div>
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
                <span className="feature-status">{feature.status}</span>
              </article>
            ))}
          </div>

          <div className="ai-note">
            <span className="eyebrow">GUIDANCE WITH CONTEXT</span>
            <p>
              Human-reviewed instructions come first, with localized alerts for
              operators and designated farm contacts. Predictive alerts are a
              future feature, to be developed and validated using pilot data.
            </p>
          </div>
        </section>

        <section className="container demo-section" id="demo">
          <div className="demo-copy">
            <p className="eyebrow">A GLIMPSE OF THE EXPERIENCE</p>
            <h2>See the change.<br />Understand the alert.</h2>
            <p>
              Each alert identifies the pond, the parameter, and the
              readings behind it.
            </p>
            <span className="demo-label">Illustrative demo · Not live data</span>
          </div>

          <article className="demo-card" aria-label="Example pond alert">
            <div className="demo-heading">
              <span>POND 02</span>
              <span className="demo-label">Sample alert</span>
            </div>

            <h3>Oxygen reading decreased</h3>

            <div className="reading-comparison">
              <div>
                <span>Previous</span>
                <strong>5.8 <small>mg/L</small></strong>
              </div>
              <span className="reading-arrow" aria-hidden="true">→</span>
              <div>
                <span>Current</span>
                <strong>2.9 <small>mg/L</small></strong>
              </div>
            </div>

            <p className="demo-message">
              Example alert: verify the reading and inspect pond conditions.
            </p>

            <p className="demo-footnote">
              SMS preview only. No message has been sent.
            </p>
          </article>
        </section>

        <section className="container about-section" id="about">
          <p className="eyebrow">BUILT WITH FARM OPERATORS IN MIND</p>
          <h2>Clear information.<br />Room for better decisions.</h2>
          <p>
            SINAYA — Sensor Intelligence Network for Aquaculture Yield Analytics —
            is a student-built prototype for medium-to-large Philippine fish and
            shrimp farms. Our approach starts with dedicated sensors in each pond,
            connected through a shared farm gateway. Water-quality readings and
            local weather forecasts provide the context for guidance from a
            human-reviewed action library.
          </p>
        </section>
      </main>

      <SiteFooter />

      {notice && (
        <div
          className="notice-backdrop"
          onClick={(event) => {
            if (event.target === event.currentTarget) setNotice("");
          }}
        >
          <dialog
            open
            className="notice-dialog"
            aria-labelledby="notice-title"
            ref={(element) => {
              element?.querySelector<HTMLButtonElement>("button")?.focus();
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") setNotice("");
              // The close button is the dialog's only interactive element.
              if (event.key === "Tab") event.preventDefault();
            }}
          >
            <p className="eyebrow">LANDING PAGE PREVIEW</p>
            <h2 id="notice-title">One step at a time.</h2>
            <p>{notice}</p>
            <button
              className="button button-primary"
              onClick={() => setNotice("")}
            >
              Got it
            </button>
          </dialog>
        </div>
      )}
    </div>
  );
}

export default App;



