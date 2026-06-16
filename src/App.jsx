import { useState } from 'react'
import SingleRace from './SingleRace'
import Ganyan from './Ganyan'

export default function App() {
  const [experience, setExperience] = useState('single') // single | ganyan | online

  return (
    <>
      <nav className="mode-tabs">
        <button className={experience === 'single' ? 'active' : ''} onClick={() => setExperience('single')}>Tekli Yarış</button>
        <button className={experience === 'ganyan' ? 'active' : ''} onClick={() => setExperience('ganyan')}>6'lı Ganyan</button>
        <button className={experience === 'online' ? 'active' : ''} onClick={() => setExperience('online')}>Online</button>
      </nav>
      {experience === 'single' && <SingleRace />}
      {experience === 'ganyan' && <Ganyan key="solo" />}
      {experience === 'online' && <Ganyan key="online" online />}
    </>
  )
}
