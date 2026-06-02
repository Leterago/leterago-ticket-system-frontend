import React from "react";

const Tap = ({ label, icon, active, onClick }: { label: string; icon: React.ReactNode; active: boolean; onClick: () => void }) => {
  return (
    <button
      className={`flex items-center gap-3 px-3 py-2.5 rounded cursor-pointer transition-all w-full text-left
        ${active
          ? "bg-blue-50 text-[#0047AC] font-semibold"
          : "text-gray-600 hover:bg-gray-50 hover:text-gray-800 font-medium"
        }`}
      onClick={onClick}
    >
      <span className={active ? "text-[#0047AC]" : "text-gray-400"}>{icon}</span>
      <span className="text-sm">{label}</span>
      {active && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#0047AC]" />}
    </button>
  );
};

export default Tap;
