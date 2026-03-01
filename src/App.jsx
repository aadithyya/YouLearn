
import React, { useState } from "react";
import Sidebar from "./components/sidebar/Sidebar";
import Main from "./components/Main/Main";

const App = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <>
      <Sidebar
        extended={sidebarOpen}
        onToggle={() => setSidebarOpen(prev => !prev)}
        onClose={() => setSidebarOpen(false)}
      />
      <Main onMenuClick={() => setSidebarOpen(prev => !prev)} />
    </>
  );
};

export default App;