import sinaya from '../assets/logo/Sinaya.png';
import apollo from '../assets/logo/apollo.png';
import usep from '../assets/logo/usep.png';
import './SiteFooter.css';

export default function SiteFooter() {
  return <footer className="sinaya-footer" aria-label="Site footer"><div className="container">
    <div className="sinaya-footer-identity"><div className="sinaya-footer-logos"><img src={sinaya} alt="SINAYA" /><img src={apollo} alt="Apollo Creations" /><img src={usep} alt="University of Southeastern Philippines" /></div><p>Clearer pond insights for everyday farming.</p></div>
    <div className="sinaya-footer-bottom"><span>© {new Date().getFullYear()} Sinaya. All rights reserved.</span><span className="sinaya-developer-credit">Developed by <strong>Apollo Creations</strong></span></div>
  </div></footer>;
}
