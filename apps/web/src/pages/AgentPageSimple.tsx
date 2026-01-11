/**
 * Simplified Agent Page for Testing
 */

import { useState } from 'react';

export function AgentPageSimple() {
  const [message, setMessage] = useState('');
  const [count, setCount] = useState(0);

  return (
    <div style={{ padding: '20px', minHeight: '100vh', backgroundColor: '#f5f5f5' }}>
      <h1>Simple Test Page</h1>
      
      <button 
        onClick={() => {
          console.log('Button clicked!');
          alert('Button works!');
          setCount(count + 1);
        }}
        style={{
          padding: '10px 20px',
          fontSize: '16px',
          cursor: 'pointer',
          backgroundColor: '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          marginTop: '10px',
        }}
      >
        Click Me (Count: {count})
      </button>

      <div style={{ marginTop: '20px' }}>
        <input
          type="text"
          value={message}
          onChange={(e) => {
            console.log('Input changed:', e.target.value);
            setMessage(e.target.value);
          }}
          placeholder="Type here..."
          style={{
            padding: '10px',
            fontSize: '16px',
            width: '300px',
            border: '1px solid #ccc',
            borderRadius: '4px',
          }}
        />
        <p>You typed: {message}</p>
      </div>
    </div>
  );
}

