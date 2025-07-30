import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import "font-awesome/css/font-awesome.min.css";
import './App.css'; // Import the CSS file for the App component

import { UserProvider } from "./contexts/UserContext";
import { CameraProvider } from "./contexts/CameraContext";

import Home from "./pages/Home";

import Settings from "./pages/Settings";
import RecordHandSize from "./pages/RecordHandSize";
import Statistics from "./pages/Statistics"; 
import Documentation from "./pages/Documentation";
import Disclaimer from "./pages/Disclaimer";
import Header from "./components/Header";
import BlockPlacementTest from "./pages/BlockPlacementTest";

function App() {
  return (
    <UserProvider>
      <CameraProvider>
        <Router>
          <div className="full-screen-element">
        
            {/* Header */}
            <Header/>
            
            {/* Pages */}
            <div className="page-content">
              <Routes>
                <Route path="/" element={<Home/>} />
                <Route path="/settings" element={<Settings/>} />
                <Route path="/recordhandsize" element={<RecordHandSize/>} />
                <Route path="/statistics" element={<Statistics/>} />
                <Route path="/documentation" element={<Documentation/>} />
                <Route path="/disclaimer" element={<Disclaimer/>} />

                <Route path="/BlockPlacementTest" element={<BlockPlacementTest/>} />
              </Routes>
            </div>
          </div>
        </Router>
      </CameraProvider>
    </UserProvider>
   
  );
}

export default App;
