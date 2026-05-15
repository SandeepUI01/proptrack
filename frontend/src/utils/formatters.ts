
export const getSeverityStyle = (s: string) => {
  const styles: Record<string, string> = {
    CRITICAL: 'text-red-600',
    HIGH: 'text-orange-600',
    MEDIUM: 'text-yellow-600'
  }
  return styles[s] || 'text-green-600'
}

export const getSeverityBorder = (s: string) => {
  const borders: Record<string, string> = {
    CRITICAL: 'border-l-red-500',
    HIGH: 'border-l-orange-500',
    MEDIUM: 'border-l-yellow-500'
  }
  return borders[s] || 'border-l-green-500'
}

export const getSeverityBg = (s: string) => {
  const bgs: Record<string, string> = {
    CRITICAL: 'bg-red-50',
    HIGH: 'bg-orange-50',
    MEDIUM: 'bg-yellow-50'
  }
  return bgs[s] || 'bg-green-50'
}

export const formatTimestamp = (ts: number) => {
  return new Date(ts).toLocaleTimeString('en-GB', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3
  })
}