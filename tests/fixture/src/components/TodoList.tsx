import { useState, useMemo, useRef } from "react";
import TodoItem from "./TodoItem";

function TodoList() {
  const [items, setItems] = useState(["Buy milk", "Walk dog"]);
  const inputRef = useRef<HTMLInputElement>(null);

  const itemCount = useMemo(() => items.length, [items]);

  const addTodo = () => {
    const input = inputRef.current;
    if (input && input.value.trim()) {
      setItems((prev) => [...prev, input.value.trim()]);
      input.value = "";
    }
  };

  const deleteTodo = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div>
      <h2>Todo List ({itemCount} items)</h2>
      <div>
        <input id="todo-input" ref={inputRef} placeholder="Add a todo" />
        <button id="add-todo" onClick={addTodo}>
          Add
        </button>
      </div>
      <ul>
        {items.map((text, index) => (
          <TodoItem
            key={text}
            text={text}
            onDelete={() => deleteTodo(index)}
          />
        ))}
      </ul>
    </div>
  );
}

export default TodoList;
