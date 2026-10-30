'use client';
export default function ErrorPage({reset}:{reset:()=>void}){return <main className="container section"><div className="empty-state"><h1>A little pause in our day.</h1><p>We couldn’t load this page. Please try again.</p><button className="button green" onClick={reset}>Try again</button><a href="/">Back to Petify</a></div></main>}
