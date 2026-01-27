import { UserProfile } from '@clerk/clerk-react'

export default function ProfilePage() {
  return (
    <div className="flex-1 p-6 overflow-auto">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Profile Settings</h1>
        <UserProfile 
          routing="path"
          path="/profile"
        />
      </div>
    </div>
  )
}
