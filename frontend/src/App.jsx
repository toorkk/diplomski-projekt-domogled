import { useState } from "react";
import Navbar from "./Navbar";
import Zemljevid from "./Strani/Zemljevid/Zemljevid";
import Statistika from "./Strani/Statistika/Statistika";
import OPodatkih from "./Strani/OPodatkih"; 

export default function App() {
  const [activePage, setActivePage] = useState('zemljevid');
  const [selectedRegionForStatistics, setSelectedRegionForStatistics] = useState(null);

  // Handler za navigacijo na statistike iz zemljevida
  const handleNavigateToStatistics = (regionData) => {
    setSelectedRegionForStatistics(regionData);
    setActivePage('statistika');
  };

  // Ko se spremeni aktivna stran, resetiraj regijo če ni statistika
  const handlePageChange = (page) => {
    if (page !== 'statistika') {
      setSelectedRegionForStatistics(null);
    }
    setActivePage(page);
  };

  const renderPage = () => {
    switch (activePage) {
      case 'zemljevid':
        return (
          <Zemljevid
            onNavigateToStatistics={handleNavigateToStatistics}
          />
        );
      case 'statistika':
        return (
          <Statistika
            selectedRegionFromNavigation={selectedRegionForStatistics}
          />
        );
      case 'opodatkih':
        return <OPodatkih />;
      default:
        return (
          <Zemljevid
            onNavigateToStatistics={handleNavigateToStatistics}
          />
        );
    }
  };

  return (
    <div className="relative w-full h-screen">
      <Navbar activePage={activePage} onPageChange={handlePageChange} />
      {renderPage()}
    </div>
  );
}