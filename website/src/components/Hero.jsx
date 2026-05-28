import React from 'react'

export default function Hero() {
  return (
    <div className="hero-component" style={{ padding: '20px', border: '1px dashed #646cff', borderRadius: '8px', margin: '20px 0', background: 'rgba(255,255,255,0.05)' }}>
      <h2>This is a Title. And I like it.</h2>
      <p>This is a custom Hero component to verify that the Babel auto-injection plugin is working correctly.</p>
    </div>
  )
}
