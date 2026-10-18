export function gameVocabulary(type = 'dnd') {
  const dnd = type === 'dnd';
  const custom = type === 'custom';
  return {
    dnd,
    tabs: custom ? {
      Story: 'Game overview', Items: 'Game elements', Connections: 'Piece & element relationships',
      Timeline: 'Phases & events', Notes: 'Design notes', Maps: 'Boards & reference maps',
      Characters: 'Player pieces', 'Linked projects': 'Boards & layouts', 'GM screen': 'Play aids', Playbook: 'Play guide'
    } : dnd ? {} : {
      Items: 'Factions, locations & objectives', Connections: 'Unit & campaign relationships',
      Characters: 'Units & operatives', Maps: 'Battlefields & maps', 'Linked projects': 'Battlefields & layouts',
      'GM screen': 'Play aids', Playbook: 'Campaign playbook'
    },
    help: custom ? {
      Story: 'Your game concept, rules and agreed design decisions. Develop them with your companion or use the manual editor.',
      Items: 'Record objectives, resources, areas and other game elements using your own terms. Review proposed additions before saving.',
      Connections: 'Describe how pieces, resources, objectives and areas interact under your rules. Create the related entries first.',
      Timeline: 'Arrange phases, rounds or design events using the sequence and names in your game.',
      Notes: 'Private design notes. Mark an entry player-visible when you want to include it in shared material.',
      Maps: 'Import a board, layout or reference map and add markers. Files stay on this computer.',
      Characters: 'Define player pieces, tokens, cards, units or other components. Describe their role, capabilities, resources and special rules using your own game terms.',
      'Linked projects': 'Attach a saved board or scenery layout. This keeps a project copy without changing the original.',
      'GM screen': 'Optional play aids: track turn order and use the dice calculator only if your rules call for dice.',
      Soundboard: 'Add sounds you own or use the original starter sounds for your game.',
      Playbook: 'Follow your saved game elements and layouts during play, with optional sound cues.',
      Print: 'Export a design book or player material. Review visibility before sharing.'
    } : dnd ? {} : {
      Characters: 'Define units and operatives using the profiles, equipment and special rules of your selected system and edition.',
      Notes: 'Private campaign notes. Mark an entry player-visible when you want to share it.',
      'GM screen': 'Optional play aids. Follow your selected system for turn order and dice; preset roll modes are not assumed.',
      Print: 'Export a campaign book or player material. Review visibility before sharing.'
    },
    workshop: custom ? 'YOUR GAME WORKSHOP · SAVED ON THIS PC' : 'YOUR CAMPAIGN WORKSHOP · SAVED ON THIS PC',
    intro: custom
      ? 'Tell your companion what you want to create. It will build one evolving game overview for review. Switch between rules, player pieces, boards, resources and objectives as you develop your game.'
      : dnd ? 'Tell your companion what you want to create. It will ask one question at a time and keep a single evolving campaign overview for you to review. Switch sections as you work on characters, places, quests and sessions.'
        : 'Develop your campaign with one companion. Describe your system and edition, units, factions, battlefields and objectives, then review its proposals.',
    idea: custom ? 'Tell your companion about your game idea and any rules you already have.' : 'Tell your companion your campaign idea and it will help you shape the starting brief.',
    nextLead: custom ? 'Your game overview is taking shape. ' : 'Your overview is taking shape. ',
    pieceCount: custom ? 'player pieces' : dnd ? 'character sheets' : 'units / operatives',
    pieceSingular: custom ? 'player piece' : dnd ? 'character sheet' : 'unit / operative',
    pieceLabel: custom ? 'Player piece' : dnd ? 'Character' : 'Unit / operative',
    setupLabels: {genre:custom?'Setting / style':'World / era', theme:custom?'Theme':'Tone', party:custom?'Players / roles':dnd?'Party':'Forces / roles', missions:custom?'Objectives':'Mission themes', length:custom?'Play time / scope':'Length', rules:'Rules system', boundaries:'Preferences'},
    entryCount: custom ? 'game elements' : 'story entries',
    layoutCount: custom ? 'linked boards / layouts' : 'linked worlds / encounters',
    privateLabel: dnd ? 'DM-only' : 'Private',
    privateSuffix: dnd ? 'DM' : 'private',
    itemTitle: custom ? 'Game elements' : dnd ? 'People, places & missions' : 'Factions, locations & objectives',
    itemHelp: custom ? 'Keep objectives, resources, board areas and other game elements together. Select a card to edit its details.'
      : dnd ? 'Keep your campaign’s people, locations, quests and lore together. Select a card to edit its details.'
        : 'Keep factions, locations, objectives and background together. Select a card to edit its details.',
    itemExample: custom ? 'Objective · resource · area · background' : dnd ? 'Person · place · mission · lore' : 'Faction · location · objective · background',
    category: value => custom ? ({Characters:'Player pieces', Locations:'Areas', Missions:'Objectives', Events:'Phases & events', Lore:'Background'}[value] || value) : value,
    book: custom ? 'Game design book' : 'Campaign book and cards',
    privateBook: dnd ? 'DM book · includes secrets' : custom ? 'Design book · includes private content' : 'Campaign book · includes private content',
    guide: custom ? 'Play your game' : 'Run campaign'
  };
}
