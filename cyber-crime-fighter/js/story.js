/* =========================================================================
   CYBER CRIME FIGHTER — Narrative
   Story beats delivered as cinematic panels: {scene, speaker, portrait, text}.
   ========================================================================= */
const STORY = {
  intro: [
    { scene:"apartment", speaker:"", portrait:null,
      text:"3:14 AM. Ramen steam on a cracked laptop screen. Forty-seven job applications out. Forty-seven auto-rejections back." },
    { scene:"apartment", speaker:"YOU", portrait:"student",
      text:"“Two internships, a security cert, and a maxed-out student loan… and the best offer I've got is a help-desk gig that doesn't pay rent.”" },
    { scene:"apartment", speaker:"", portrait:null,
      text:"You close another rejection. The city hums outside — somewhere out there, a very different problem is unfolding." },
    { scene:"precinct", speaker:"NEWS", portrait:null,
      text:"“…the daring daylight raid on Meridian Trust netted an estimated four-point-two million. Three suspects are in custody — but police say the money is still missing.”" },
    { scene:"interrogation", speaker:"", portrait:null,
      text:"Downtown, in a cold interview room, the crew's ringleader leans back and smiles. He knows something the detectives don't. And he isn't talking." },
    { scene:"precinct", speaker:"DET. REYES", portrait:"detective",
      text:"“The trail ends at one phone we pulled off him during the arrest. Everything — the wallet, the offshore handoff, the account — it's all on that device.”" },
    { scene:"precinct", speaker:"DET. REYES", portrait:"detective",
      text:"“We got the warrant. We got the phone. What we did NOT get… was in. One of my rookies fat-fingered a wipe trigger. Screen went black. Everything gone.”" },
    { scene:"precinct", speaker:"DET. REYES", portrait:"detective",
      text:"“So here's the play the DA signed off on. We rebuild that phone. Make it look exactly like his. Walk it back into that room and let him THINK we cracked it.”" },
    { scene:"interrogation", speaker:"DET. REYES", portrait:"detective",
      text:"“The second he believes we're already inside his account, he flips to save his own skin and cut a deal. But if the decoy looks wrong — wrong phone, wrong setup, one detail off — he'll smell it, and we lose him.”" },
    { scene:"precinct", speaker:"DET. REYES", portrait:"detective",
      text:"“My whole squad is old-school. Nobody here can build a convincing device from evidence alone. But I remembered a name from that campus security talk last spring. Yours.”" },
    { scene:"precinct", speaker:"DET. REYES", portrait:"detective",
      text:"“So I'm making the call, kid. We need your help. Pull this off, and there's a badge and a paycheck waiting for you in the Cyber Crime Unit. Blow it… and four million walks.”" },
    { scene:"precinct", speaker:"YOU", portrait:"student",
      text:"“…When do I start?”" },
  ],

  briefingIntro:
    "Detective Reyes drops a stack of evidence bags on the table.\n\n“Here's how it works. Every suspect had a different phone. For each one you'll get whatever evidence we scraped together — photos, receipts, forensics. From that, you figure out the exact device and rebuild it detail-for-detail. When you're confident, we walk it into the room. Convince the suspect and they crack. Ready?”",

  caseWin: [
    "The decoy glows to life in the detective's gloved hand. Same phone. Same lock screen. Same everything.",
    "Through the one-way glass, you watch the suspect's smile curdle. Their eyes lock onto the home screen. That's THEIR phone. That's THEIR account, open.",
    "“…okay. OKAY. I'll talk. Just — get me the deal. The money's parked in—”",
    "Detective Reyes doesn't even look up. She just slides a legal pad across the table and mouths, through the glass: nice work.",
  ],
  caseLose: [
    "The suspect takes one look at the phone and snorts.",
    "“That's not my phone. Wrong launcher. My clock never looked like that. Nice try.”",
    "They fold their arms and go silent. Detective Reyes exhales slowly and steps back into the hall.",
    "“Close. But 'close' doesn't recover four million. Reset it. We go again — and this time, sweat the details.”",
  ],

  finale: [
    { scene:"victory", speaker:"DET. REYES", portrait:"detective",
      text:"“Every last dollar. Recovered. The DA is dancing. Internal Affairs is furious we outsmarted them, which is how I know we did it right.”" },
    { scene:"precinct", speaker:"DET. REYES", portrait:"detective",
      text:"“You did in a week what my whole unit couldn't do in a month. I don't make offers I can't keep, kid. So don't make me ask twice.”" },
    { scene:"precinct", speaker:"YOU", portrait:"student",
      text:"“A real job? In high-tech crime fighting? …Yeah. Yeah, I'm in.”" },
    { scene:"victory", speaker:"", portrait:"badge",
      text:"CYBER CRIME UNIT · BADGE ISSUED. The ramen nights are over. The real cases start now." },
  ],
};
