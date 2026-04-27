import { ImageResponse } from 'next/og'
 
export const runtime = 'edge'
export const alt = 'UniMart - The Campus Marketplace'
export const size = {
  width: 1200,
  height: 630,
}
export const contentType = 'image/png'
 
export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(to bottom right, #000000, #111111)',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div
            style={{
              width: '120px',
              height: '120px',
              backgroundColor: '#d9ff00',
              color: 'black',
              borderRadius: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '80px',
              fontWeight: 'bold',
            }}
          >
            U
          </div>
          <h1 style={{ fontSize: '100px', fontWeight: '900', letterSpacing: '-0.05em', color: 'white' }}>
            UniMart.
          </h1>
        </div>
        <p style={{ fontSize: '40px', color: '#888', marginTop: '20px' }}>
          The Ultimate Campus Marketplace
        </p>
      </div>
    ),
    {
      ...size,
    }
  )
}
