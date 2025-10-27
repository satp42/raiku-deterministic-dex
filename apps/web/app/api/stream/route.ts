import { NextRequest } from "next/server"

export async function GET(request: NextRequest) {
  const stream = new ReadableStream({
    start(controller) {
      // Send heartbeat every 2 seconds
      const interval = setInterval(() => {
        const message = `data: heartbeat\n\n`
        controller.enqueue(new TextEncoder().encode(message))
      }, 2000)

      // Clean up on client disconnect
      request.signal.addEventListener("abort", () => {
        clearInterval(interval)
        controller.close()
      })
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  })
}
