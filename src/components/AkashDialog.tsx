import AkashAvatar from './AkashAvatar'

export default function AkashDialog({
  text,
  speaker = 'Akash',
}: {
  text: string
  speaker?: string
}) {
  return (
    <div className="akash">
      <AkashAvatar className="akash-avatar" size={48} />
      <div>
        <div className="akash-name">{speaker}</div>
        <p className="akash-text">{text}</p>
      </div>
    </div>
  )
}
