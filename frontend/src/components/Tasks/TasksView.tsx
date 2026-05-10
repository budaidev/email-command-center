import { useState, useMemo, useCallback, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { api, TASK_COLUMNS } from '../../api/client'
import type { Task, GtdColumn } from '../../api/client'
import { TasksHeader } from './TasksHeader'
import { Column } from './Column'
import { MinimalCard } from './MinimalCard'
import { ParkingCard } from './ParkingCard'
import { TaskDetailSheet } from './TaskDetailSheet'
import { NewTaskModal } from './NewTaskModal'
import { TaskImprovement } from './TaskImprovement'

export function TasksView() {
  const queryClient = useQueryClient()
  const [dragId, setDragId] = useState<number | null>(null)
  const [dragOverCol, setDragOverCol] = useState<string | null>(null)
  const [selected, setSelected] = useState<number | null>(null)
  const [showCompleted, setShowCompleted] = useState(true)
  const [showNewTask, setShowNewTask] = useState(false)
  const [showImprovement, setShowImprovement] = useState(false)

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['tasks', 'all'],
    queryFn: api.getTasks,
    refetchInterval: 60_000,
  })

  const { data: vikunjaStatus } = useQuery({
    queryKey: ['integrations', 'vikunja'],
    queryFn: api.getVikunjaStatus,
    refetchInterval: 120_000,
  })

  const { data: vagueData } = useQuery({
    queryKey: ['tasks', 'vague'],
    queryFn: () => api.getVagueTasks(),
    refetchInterval: 120_000,
  })
  const vagueCount = vagueData?.suggestions?.length ?? 0

  // Keyboard shortcut: N to create new task
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'n' && !e.metaKey && !e.ctrlKey && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement) && !(e.target instanceof HTMLSelectElement)) {
        e.preventDefault()
        setShowNewTask(true)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Move task mutation (optimistic)
  const moveMutation = useMutation({
    mutationFn: ({ taskId, col }: { taskId: number; col: string }) =>
      api.updateTask(taskId, { col: col as GtdColumn }),
    onMutate: async ({ taskId, col }) => {
      await queryClient.cancelQueries({ queryKey: ['tasks', 'all'] })
      const prev = queryClient.getQueryData<Task[]>(['tasks', 'all'])
      queryClient.setQueryData<Task[]>(['tasks', 'all'], old =>
        (old || []).map(t => {
          if (t.id !== taskId) return t
          return {
            ...t,
            col: col as GtdColumn,
            done: col === 'done',
            completedAt: col === 'done' ? new Date().toISOString().split('T')[0] : null,
          }
        })
      )
      return { prev }
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) queryClient.setQueryData(['tasks', 'all'], context.prev)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['tasks', 'all'] }),
  })

  const createMutation = useMutation({
    mutationFn: api.createTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', 'all'] })
      setShowNewTask(false)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.deleteTask(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', 'all'] })
      setSelected(null)
    },
  })

  const tasksByCol = useMemo(() => {
    const map: Record<string, Task[]> = {}
    TASK_COLUMNS.forEach(c => (map[c.id] = []))
    tasks.forEach(t => {
      if (map[t.col]) map[t.col].push(t)
    })
    return map
  }, [tasks])

  const openCount = tasks.filter(t => !t.done).length
  const completedThisWeek = useMemo(() => {
    const now = new Date()
    const weekAgo = new Date(now.getTime() - 7 * 86400000)
    return tasks.filter(t => {
      if (!t.completedAt) return false
      return new Date(t.completedAt + 'T00:00:00') >= weekAgo
    }).length
  }, [tasks])

  const selectedTask = selected ? tasks.find(t => t.id === selected) : null

  const onDragStart = useCallback((e: React.DragEvent, id: number) => {
    setDragId(id)
    e.dataTransfer.effectAllowed = 'move'
    try { e.dataTransfer.setData('text/plain', String(id)) } catch {}
  }, [])

  const onDragEnd = useCallback(() => {
    setDragId(null)
    setDragOverCol(null)
  }, [])

  const onDragOver = useCallback((e: React.DragEvent, colId: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverCol(colId)
  }, [])

  const onDrop = useCallback((e: React.DragEvent, colId: string) => {
    e.preventDefault()
    if (dragId !== null) {
      moveMutation.mutate({ taskId: dragId, col: colId })
    }
    onDragEnd()
  }, [dragId, moveMutation, onDragEnd])

  const columns = showCompleted
    ? TASK_COLUMNS
    : TASK_COLUMNS.filter(c => c.id !== 'done')

  if (isLoading) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)' }}>
        Loading tasks...
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <TasksHeader
        total={openCount}
        completedThisWeek={completedThisWeek}
        showCompleted={showCompleted}
        setShowCompleted={setShowCompleted}
        onNewTask={() => setShowNewTask(true)}
        onFixVague={() => setShowImprovement(true)}
        vagueCount={vagueCount}
        status={vikunjaStatus}
      />

      {/* Board */}
      <div
        className="scroll"
        style={{ flex: 1, overflow: 'auto', padding: '20px 24px 28px' }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${columns.length}, minmax(240px, 1fr))`,
            gap: 14,
            minHeight: '100%',
          }}
        >
          {columns.map(col => (
            <Column
              key={col.id}
              col={col}
              count={tasksByCol[col.id]?.length || 0}
              isDropTarget={dragOverCol === col.id}
              onDragOver={(e) => onDragOver(e, col.id)}
              onDrop={(e) => onDrop(e, col.id)}
            >
              {(tasksByCol[col.id] || []).map(t =>
                col.id === 'some' ? (
                  <ParkingCard
                    key={t.id}
                    task={t}
                    dragging={dragId === t.id}
                    onDragStart={(e) => onDragStart(e, t.id)}
                    onDragEnd={onDragEnd}
                    onClick={() => setSelected(t.id)}
                  />
                ) : (
                  <MinimalCard
                    key={t.id}
                    task={t}
                    col={col.id}
                    dragging={dragId === t.id}
                    onDragStart={(e) => onDragStart(e, t.id)}
                    onDragEnd={onDragEnd}
                    onClick={() => setSelected(t.id)}
                  />
                )
              )}
              {/* Add card stub */}
              <button
                onClick={() => setShowNewTask(true)}
                style={{
                  padding: '8px 12px',
                  background: 'transparent',
                  border: '1px dashed var(--line)',
                  borderRadius: 9,
                  color: 'var(--text-4)',
                  fontSize: 12,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  width: '100%',
                  textAlign: 'left',
                }}
              >
                <Plus size={12} />
                Add task
              </button>
            </Column>
          ))}
        </div>
      </div>

      {/* Detail sheet */}
      {selectedTask && (
        <TaskDetailSheet
          task={selectedTask}
          onClose={() => setSelected(null)}
          onMove={(col) => {
            moveMutation.mutate({ taskId: selectedTask.id, col })
            setSelected(null)
          }}
          onDelete={() => deleteMutation.mutate(selectedTask.id)}
        />
      )}

      {/* New task modal */}
      {showNewTask && (
        <NewTaskModal
          onClose={() => setShowNewTask(false)}
          onSubmit={(data) => createMutation.mutate(data)}
        />
      )}

      {/* Task improvement modal */}
      {showImprovement && (
        <TaskImprovement
          onClose={() => {
            setShowImprovement(false)
            queryClient.invalidateQueries({ queryKey: ['tasks', 'vague'] })
          }}
        />
      )}
    </div>
  )
}
