import React from 'react'
import { Outlet, useLocation } from 'react-router-dom'

export default function Root() {
  const location = useLocation()

  return (
    <div className="min-h-screen bg-black">
      <div key={location.pathname} className="page-fade">
        <Outlet />
      </div>
    </div>
  )
}
