import { useState, useEffect, useCallback } from "react";

function Counter() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    console.log("Counter mounted");
  }, []);

  const increment = useCallback(() => {
    setCount((prev) => prev + 1);
  }, []);

  return (
    <div>
      <h2>Counter</h2>
      <p>Count: {count}</p>
      <button id="increment" onClick={increment}>
        Increment
      </button>
    </div>
  );
}

export default Counter;
