import * as React from "react"

const TabsContext = React.createContext<{
  value: string
  onValueChange: (value: string) => void
} | null>(null)

export const Tabs = ({ 
  value, 
  onValueChange, 
  className = '', 
  children 
}: {
  value: string
  onValueChange: (value: string) => void
  className?: string
  children: React.ReactNode
}) => {
  return (
    <TabsContext.Provider value={{ value, onValueChange }}>
      <div className={className}>
        {children}
      </div>
    </TabsContext.Provider>
  )
}

export const TabsList = ({ className = '', children }: { className?: string; children: React.ReactNode }) => (
  <div className={[
    'inline-flex h-10 items-center justify-center rounded-lg bg-neutral-100 p-1 text-neutral-500',
    className
  ].join(' ')}>
    {children}
  </div>
)

export const TabsTrigger = ({ 
  value, 
  className = '', 
  children 
}: { 
  value: string
  className?: string
  children: React.ReactNode 
}) => {
  const context = React.useContext(TabsContext)
  if (!context) throw new Error('TabsTrigger must be used within Tabs')
  
  const isActive = context.value === value
  
  return (
    <button
      className={[
        'inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ring-offset-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
        isActive 
          ? 'bg-white text-neutral-950 shadow-sm' 
          : 'text-neutral-500 hover:text-neutral-900',
        className
      ].join(' ')}
      onClick={() => context.onValueChange(value)}
    >
      {children}
    </button>
  )
}

export const TabsContent = ({ 
  value, 
  className = '', 
  children 
}: { 
  value: string
  className?: string
  children: React.ReactNode 
}) => {
  const context = React.useContext(TabsContext)
  if (!context) throw new Error('TabsContent must be used within Tabs')
  
  if (context.value !== value) return null
  
  return (
    <div className={[
      'mt-2 ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 focus-visible:ring-offset-2',
      className
    ].join(' ')}>
      {children}
    </div>
  )
}
