import { useEffect } from "react";

function ConsoleDemo() {
  useEffect(() => {
    console.log("Hello from ConsoleDemo");
    console.error("Test error message");
  }, []);

  return (
    <div>
      <h2>Console Demo</h2>
      <p>Check the browser console for messages.</p>
    </div>
  );
}

export default ConsoleDemo;
