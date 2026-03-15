interface TodoItemProps {
  text: string;
  onDelete: () => void;
}

function TodoItem({ text, onDelete }: TodoItemProps) {
  return (
    <li>
      <span>{text}</span>
      <button onClick={onDelete}>Delete</button>
    </li>
  );
}

export default TodoItem;
