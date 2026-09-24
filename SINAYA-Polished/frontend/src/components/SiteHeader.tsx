import logo from '../assets/logo/Sinaya.png';

export default function SiteHeader({ dashboard = false }: { dashboard?: boolean }) {
  return <header className="site-header"><nav className="container navigation" aria-label="Main navigation">
    <a href="#home" className="brand" aria-label="Sinaya home"><img src={logo} alt="" /><span>SINAYA</span></a>
    <div className="nav-links">
      <a href="#features">Features</a><a href="#about">About</a><a href="#register-pond">Register pond</a><a href="#dashboard" aria-current={dashboard ? 'page' : undefined}>Dashboard</a>
    </div>
    <a className="button button-outline nav-login" href="#login">Log In <span aria-hidden="true">↗</span></a>
  </nav></header>;
}
