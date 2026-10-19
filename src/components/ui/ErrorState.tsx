interface ErrorStateProps {
  message?: string
  onRetry?: () => void
}

export default function ErrorState({ message = 'Error al cargar datos', onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <span className="text-3xl text-danger mb-3">⚠</span>
      <h3 className="text-sm font-medium text-text-secondary mb-1">{message}</h3>
      {onRetry && (
        <button
          onClick={onRetry}
          className="btn-ghost mt-4"
        >
          Reintentar
        </button>
      )}
    </div>
  )
}
