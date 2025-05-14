import { useState } from "react";
import Navbar from "./Navbar";
import Zemljevid from "./Strani/Zemljevid";
import Primerjevalnik from "./Strani/Primerjevalnik";
import Statistika from "./Strani/Statistika";
import Izracun from "./Strani/Izračun";

export default function App() {
  const [activePage, setActivePage] = useState('zemljevid');

  const renderPage = () => {
    switch(activePage) {
      case 'zemljevid':
        return <Zemljevid />;
      case 'primerjevalnik':
        return <Primerjevalnik />;
      case 'statistika':
        return <Statistika />;
      case 'izracun':
        return <Izracun />;
      default:
        return <Zemljevid />;
    }
  };

  return (
    <div className="relative w-screen h-screen">
      <Navbar activePage={activePage} onPageChange={setActivePage} />
      {renderPage()}
      
      
    </div>
  );
}