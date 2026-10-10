type Meeting = {
  id?: string;
  title?: string;
  date?: string;
  agenda_url?: string;
  time?: string;
  body?: string;
  meeting_url?: string;
};

type FeedStripProps = {
  meetings?: Meeting[];
};

export default function FeedStrip({ meetings = [] }: FeedStripProps) {
  return (
    <div className="glass-panel">
      <h2 className="window-bar window-green">Upcoming Meetings</h2>
      <div className="panel-body">
        {meetings.length > 0 ? (
          <div className="meeting-list">
            {meetings.slice(0, 5).map((meeting, index) => {
              const title = meeting.title || meeting.body || `Meeting ${index + 1}`;
              const date = meeting.date || "Date TBD";
              const href = meeting.agenda_url || meeting.meeting_url;

              return (
                <div key={`${meeting.id ?? title}-${index}`} className="meeting-item">
                  <div>
                    <strong>{title}</strong>
                    <div className="muted">{date}{meeting.time ? ` · ${meeting.time}` : ""}</div>
                  </div>
                  {href ? (
                    <a href={href} target="_blank" rel="noreferrer" className="source-link">
                      Open agenda
                    </a>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="muted">Town council meetings and agenda links will appear here.</p>
        )}
      </div>
    </div>
  );
}
