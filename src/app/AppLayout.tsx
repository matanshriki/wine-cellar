import { Outlet, Link, useNavigate } from 'react-router-dom'
import { Baby, LogOut, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { signOut } from '@/features/auth/api'
import { useToast } from '@/components/ui/use-toast'

export function AppLayout() {
  const navigate = useNavigate()
  const { toast } = useToast()

  const handleSignOut = async () => {
    try {
      await signOut()
      navigate('/login')
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to sign out',
      })
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/app" className="flex items-center space-x-2 font-semibold text-lg">
            <Baby className="h-6 w-6 text-primary" />
            <span>Baby Tracker</span>
          </Link>

          <div className="flex items-center space-x-2">
            <Button variant="ghost" size="icon" asChild>
              <Link to="/app/workspace/current/settings">
                <Settings className="h-5 w-5" />
              </Link>
            </Button>
            <Button variant="ghost" size="icon" onClick={handleSignOut}>
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="container mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}

