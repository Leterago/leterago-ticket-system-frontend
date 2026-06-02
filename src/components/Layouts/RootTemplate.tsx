import { Outlet, useLocation } from "react-router-dom";
import SideBar from "../Templates/SideBar";
import NavBar from "../Molecules/NavBar";
import { useRef, useEffect } from "react";

const RootTemplate = () => {
  const { pathname } = useLocation();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, 0);
  }, [pathname]);

  const content = (
    <div className="flex flex-row w-full h-screen bg-gray-50">
      <SideBar />
      <div className="flex flex-col flex-1 min-w-0">
        <div className="h-14 shrink-0">
          <NavBar />
        </div>
        <div ref={scrollRef} className="flex-1 overflow-auto">
          <Outlet />
        </div>
      </div>
    </div>
  );

  return content;
};

export default RootTemplate;
