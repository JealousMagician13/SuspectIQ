export default function NavBar() {
  return (
    <header className="top-nav">
      <a className="brand" href="/" aria-label="SuspectIQ home">SUSPECTIQ</a>
      <nav aria-label="Primary navigation">
        <a href="#home">Home</a>
        <a href="#about">About</a>
        <a href="#upload">Demo</a>
        <a href="#team">Team</a>
      </nav>
    </header>
  )
}
