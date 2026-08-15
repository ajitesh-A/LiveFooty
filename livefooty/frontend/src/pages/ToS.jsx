export default function ToS() {
  const sections = [
    {
      title: '1. Service Description',
      body: 'LiveFooty is a free web service that aggregates and surfaces public links to football match streams and provides live scores and fixtures from public data sources. LiveFooty does not host, encode, transmit, or store any audiovisual content itself.',
    },
    {
      title: '2. Third-Party Content',
      body: 'Streams displayed on the site originate from third parties over whom LiveFooty has no control. LiveFooty is not responsible for the availability, legality, or quality of third-party streams, and links may change or expire without notice.',
    },
    {
      title: '3. No Warranty',
      body: 'The service is provided "as is" and "as available", without warranties of any kind, express or implied. Scores, schedules, and lineup data are aggregated from public APIs and may be incomplete, delayed, or inaccurate.',
    },
    {
      title: '4. Acceptable Use',
      body: 'You agree not to misuse the service, attempt to gain unauthorized access, scrape or overload the service, or use it for unlawful purposes. You are responsible for ensuring your own use of third-party streams complies with applicable law in your jurisdiction.',
    },
    {
      title: '5. Intellectual Property',
      body: 'Team names, crests, and competition names remain the property of their respective owners and are used for identification purposes only. All other site content is © LiveFooty.',
    },
    {
      title: '6. Limitation of Liability',
      body: 'To the maximum extent permitted by law, LiveFooty shall not be liable for any indirect, incidental, or consequential damages arising from your use of, or inability to use, the service.',
    },
    {
      title: '7. DMCA / Takedown',
      body: 'If you believe content linked through the service infringes your rights, contact us with the specific link and details. We will review and remove or disable access within a reasonable time.',
    },
    {
      title: '8. Privacy',
      body: 'LiveFooty does not create accounts and does not collect personal data. Notification subscriptions and read state are stored locally in your browser only and never transmitted to our servers.',
    },
    {
      title: '9. Changes to These Terms',
      body: 'We may update these terms from time to time. Continued use of the service after changes constitutes acceptance of the revised terms.',
    },
  ]

  return (
    <div className="max-w-[1120px] mx-auto px-4 md:px-6 py-12 space-y-8">
      <div className="pt-6">
        <h1 className="font-headline text-4xl md:text-5xl font-bold text-ink-100 tracking-tight leading-tight">
          Terms of Service
        </h1>
        <p className="text-ink-500 mt-3 text-sm">Last updated: August 2026</p>
      </div>

      <div className="bg-night-800 rounded-lg border border-night-750 shadow-lg p-6 md:p-10 space-y-8">
        <p className="text-ink-500 leading-relaxed">
          Welcome to LiveFooty. By accessing or using this website you agree to the following terms.
          If you do not agree, please do not use the service.
        </p>
        {sections.map((s) => (
          <section key={s.title}>
            <h2 className="font-headline font-semibold text-lg text-ink-100 mb-2 tracking-tight">
              {s.title}
            </h2>
            <p className="text-sm leading-relaxed text-ink-500">{s.body}</p>
          </section>
        ))}
      </div>
    </div>
  )
}