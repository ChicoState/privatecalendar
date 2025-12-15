import React, { createContext, useContext, useState } from "react";

const TaskContext = createContext({
  tasks: [],
  setTasks: (tasks: any[]) => { },
});

// Provider wraps the app
export const TaskProvider = ({ children }) => {
  const [tasks, setTasks] = useState([]);

  return (
    <TaskContext.Provider value={{ tasks, setTasks }}>
      {children}
    </TaskContext.Provider>
  );
};

// Hook used by screens
export const useTasks = () => useContext(TaskContext);
