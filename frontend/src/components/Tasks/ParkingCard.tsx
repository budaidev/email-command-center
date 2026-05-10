import type { Task } from '../../api/client'

interface ParkingCardProps {
  task: Task
  dragging: boolean
  onDragStart: (e: React.DragEvent) => void
  onDragEnd: () => void
  onClick: () => void
}

export function ParkingCard({ task, dragging, onDragStart, onDragEnd, onClick }: ParkingCardProps) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      style={{
        padding: '6px 10px',
        background: 'var(--surface)',
        border: '1px solid var(--line-soft)',
        borderRadius: 7,
        fontSize: 12,
        color: 'var(--text-2)',
        cursor: 'grab',
        opacity: dragging ? 0.4 : 1,
        lineHeight: 1.4,
      }}
    >
      {task.title}
    </div>
  )
}
