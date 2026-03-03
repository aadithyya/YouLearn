import React, { useState } from "react";
import Sidebar from "./components/sidebar/Sidebar";
import Main from "./components/main/main";
import Login from "./components/login/Login";

const App = () => {
  const [loggedIn, setLoggedIn] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (!loggedIn) {
    return <Login onLogin={() => setLoggedIn(true)} />;
  }

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