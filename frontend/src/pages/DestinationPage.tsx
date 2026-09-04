import { useParams } from 'react-router-dom'

export default function DestinationPage() {
  const { id } = useParams<{ id: string }>()

  return (
    <section className="mx-auto max-w-6xl px-6 py-16">
      <h1 className="text-3xl font-bold text-slate-900">旅行先</h1>
      <p className="mt-4 text-slate-600">旅行先 ID: {id}</p>
    </section>
  )
}
