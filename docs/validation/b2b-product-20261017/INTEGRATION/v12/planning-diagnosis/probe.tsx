import {createRoot} from 'react-dom/client'
import {AccountProvider} from '@klisteniapp/b2b-react'
import {PeriodImpactEditor} from '/workspace/klisteniapp/apps/b2b-web/src/features/programs/product/PeriodImpactEditor'
import {GoalProgramEditor} from '/workspace/klisteniapp/apps/b2b-web/src/features/programs/product/GoalProgramEditor'
import '/workspace/klisteniapp/packages/b2b-ui/src/styles.css'
import '/workspace/klisteniapp/apps/b2b-web/src/features/programs/product/programming.css'
const invalid=new URL(location.href).searchParams.has('invalid')
const routine={programId:'20256214-75e7-46e4-bd4b-c85e5157c58d',version:1,schemaVersion:2}
const content={name:invalid?'WP12 invalid dates 4d69b128-00ae-4cb8-8b0b-ec672dcf8923':'WP12 goal 0a2f5b29-917b-49c2-b115-c691eaf22713',goal:'Preserve routine, occurrence and actual links',timeZone:'UTC',stages:[{id:'stage1',name:'Synthetic stage',startDate:'2026-04-13',endDate:'2026-04-19',slots:[{id:'monday',weekday:1,routine}]},...(invalid?[{id:'stage2',name:'Reject overlapping and out-of-order stage',startDate:'2026-10-26',endDate:null,slots:[{id:'monday2',weekday:1,routine}]}]:[])]}
const choices=[{name:'SYNTHETIC TEST ONLY: repetitions-to-duration prescription',reference:{...routine,programId:'synthetic'}},{name:'WP12 875c04c7-b653-409a-a888-cdaf4c9e1bbc',reference:{...routine,programId:'other'}},{name:'WP12 20256214-75e7-46e4-bd4b-c85e5157c58d',reference:routine},{name:'Inicio · fuerza y técnica',reference:{...routine,programId:'demo'}}]
const enrollment={schemaVersion:2,id:'2752a5c9-566a-4788-b13d-53a441572a0a',scope:{organizationId:'org',branchId:'main',memberId:'member'},goalProgramId:'goal',issuedGoalRevision:1,revision:2,status:'active',content,createdAt:'2026-10-17T12:00:00Z'}
const client={call:async()=>{throw new Error('This read-only layout diagnostic does not perform service calls')}}
const noop=()=>{}
createRoot(document.getElementById('root')!).render(<AccountProvider userId="coach" branchId="main" role="coach"><main className="main-content programming">{invalid?<GoalProgramEditor orgId="org" memberId="member" client={client as any} goal={{...content,schemaVersion:2,id:'goal',scope:enrollment.scope,revision:1,status:'draft',archivedAt:null} as any} choices={choices as any} onSaved={noop} onEnrolled={noop} onClose={noop}/>:<PeriodImpactEditor orgId="org" client={client as any} enrollment={enrollment as any} choices={choices as any} onSaved={noop} onClose={noop}/>}</main></AccountProvider>)
