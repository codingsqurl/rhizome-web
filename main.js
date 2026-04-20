    <script type="module">
        import * as THREE from 'three';
        
        const REGIONS = {
            frontal: { c: '#e8b923', name: 'Frontal', x: 0, y: 4, z: 4 },
            parietal: { c: '#4a9eff', name: 'Parietal', x: 0, y: 5, z: -1 },
            temporalL: { c: '#58c468', name: 'Temporal L', x: -3, y: 1, z: -1 },
            temporalR: { c: '#58c468', name: 'Temporal R', x: 3, y: 1, z: -1 },
            occipital: { c: '#9b5de8', name: 'Occipital', x: 0, y: 2, z: -5 },
            limbic: { c: '#ef5da2', name: 'Limbic', x: 0, y: -1, z: -2 },
            cerebellum: { c: '#4ecdc4', name: 'Cerebellum', x: 0, y: -4, z: -4 },
            philosophy: { c: '#f472c6', name: 'Philosophy', x: 0, y: -6, z: 0 },
            projects: { c: '#22d3ee', name: 'Projects', x: 0, y: -7.5, z: -1.5 },
            code: { c: '#34d399', name: 'Code', x: 0, y: -9, z: -2.5 },
        };
        
        let notes = [];
        let connections = [];
        let selectedNote = null;
        let filterRegion = null;
        let searchQuery = '';
        
        const canvas = document.getElementById('canvas');
        const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
        
        renderer.setSize(window.innerWidth, window.innerHeight);
        scene.background = new THREE.Color(0x050508);
        scene.add(new THREE.AmbientLight(0xffffff, 0.6));
        
        camera.position.set(0, 5, 25);
        
        let rotX = 0, rotY = 0;
        let lastX, lastY, isDrag = false;
        
        const nodeMeshes = [];
        const connectionLines = null;
        
        const sphereGeo = new THREE.SphereGeometry(0.15, 8, 8);
        
        function init() {
            loadData();
            
            if (notes.length === 0) {
                createSampleNotes();
            }
            
            createBrainOutline();
            computeAutoConnections();
            createNoteMeshes();
            
            updateRegionsList();
            updateNotesList();
            
            canvas.addEventListener('mousedown', e => { isDrag = true; lastX = e.clientX; lastY = e.clientY; });
            canvas.addEventListener('mouseup', () => isDrag = false);
            canvas.addEventListener('mousemove', e => {
                if (isDrag) {
                    rotY += (e.clientX - lastX) * 0.005;
                    rotX += (e.clientY - lastY) * 0.005;
                    rotX = Math.max(-1, Math.min(1, rotX));
                    lastX = e.clientX; lastY = e.clientY;
                }
            });
            canvas.addEventListener('click', onCanvasClick);
            canvas.addEventListener('wheel', e => {
                camera.position.z += e.deltaY * 0.02;
                camera.position.z = Math.max(15, Math.min(50, camera.position.z));
            });
            
            window.addEventListener('resize', () => {
                camera.aspect = window.innerWidth / window.innerHeight;
                camera.updateProjectionMatrix();
                renderer.setSize(window.innerWidth, window.innerHeight);
            });
            
            populateRegionSelect();
            
            loop();
        }
        
        function loadData() {
            const saved = localStorage.getItem('rhizome_notes');
            if (saved) {
                const data = JSON.parse(saved);
                notes = data.notes || [];
                connections = data.connections || [];
            }
        }
        
        function saveData() {
            localStorage.setItem('rhizome_notes', JSON.stringify({
                notes,
                connections
            }));
        }
        
        function createSampleNotes() {
            const samples = [
                { title: 'The Mind on Fire', content: 'Robert D. Richardson book on Emerson', region: 'philosophy' },
                { title: 'Emerson Quotes', content: 'Collection of Ralph Waldo Emerson quotes', region: 'philosophy' },
                { title: 'PKM System', content: 'Personal Knowledge Management notes', region: 'projects' },
                { title: 'Graph View', content: 'Visualizing non-hierarchical networks', region: 'code' },
                { title: 'Zettelkasten', content: 'Slip-box method for note-taking', region: 'philosophy' },
                { title: 'Aspen Grove', content: 'Metaphor for networked thought', region: 'philosophy' },
                { title: 'Rhizome Project', content: '3D brain visualization', region: 'projects' },
                { title: 'Obsidian Vault', content: 'Main PKM vault structure', region: 'code' },
                { title: 'Memory Palaces', content: 'Spatial memory techniques', region: 'limbic' },
                { title: 'Neural Networks', content: 'Biological and digital parallels', region: 'code' },
                { title: 'Creativity Flow', content: 'State of creative flow', region: 'frontal' },
                { title: 'Spatial Navigation', content: 'How we navigate space', region: 'parietal' },
            ];
            
            samples.forEach((s, i) => {
                addNote(s.title, s.content, s.region, i * 5);
            });
        }
        
        function addNote(title, content, region, index = 0) {
            const r = REGIONS[region];
            const pos = getPositionForRegion(region, index);
            
            const note = {
                id: Date.now() + Math.random(),
                title: title || 'Untitled',
                content: content || '',
                region: region,
                x: pos.x,
                y: pos.y,
                z: pos.z,
                created: Date.now()
            };
            
            notes.push(note);
            saveData();
            return note;
        }
        
        function getPositionForRegion(region, index) {
            const r = REGIONS[region];
            const angle = (index / 20) * Math.PI * 2;
            const radius = 1 + Math.random() * 1.5;
            
            return {
                x: r.x + Math.cos(angle) * radius,
                y: r.y + (Math.random() - 0.5) * 1,
                z: r.z + Math.sin(angle) * radius
            };
        }
        
        function createNote() {
            const region = filterRegion || 'frontal';
            const note = addNote('New Thought', '', region, notes.length);
            createNoteMesh(note);
            selectNote(note);
            updateNotesList();
        }
        
        function deleteCurrentNote() {
            if (!selectedNote) return;
            
            notes = notes.filter(n => n.id !== selectedNote.id);
            connections = connections.filter(c => c.from !== selectedNote.id && c.to !== selectedNote.id);
            
            saveData();
            closeDetail();
            rebuildScene();
        }
        
        function updateCurrentNote() {
            if (!selectedNote) return;
            
            const oldContent = selectedNote.content;
            const oldRegion = selectedNote.region;
            
            selectedNote.title = document.getElementById('detailTitleInput').value;
            selectedNote.content = document.getElementById('detailContent').value;
            selectedNote.region = document.getElementById('detailRegion').value;
            
            if (selectedNote.content !== oldContent) {
                const contentHash = hashContent(selectedNote.content);
                const r = REGIONS[selectedNote.region];
                selectedNote.x = r.x + (Math.sin(contentHash) * 1.5);
                selectedNote.y = r.y + (Math.cos(contentHash) * 0.8);
                selectedNote.z = r.z + (Math.sin(contentHash * 0.7) * 1.2);
            }
            
            if (selectedNote.region !== oldRegion) {
                const pos = getPositionForRegion(selectedNote.region, notes.indexOf(selectedNote));
                selectedNote.x = pos.x;
                selectedNote.y = pos.y;
                selectedNote.z = pos.z;
            }
            
            computeAutoConnections();
            rebuildScene();
            saveData();
            updateNotesList();
        }
        
        function hashContent(content) {
            let hash = 0;
            for (let i = 0; i < content.length; i++) {
                const char = content.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash = hash & hash;
            }
            return Math.abs(hash);
        }
        
        function selectNote(note) {
            selectedNote = note;
            
            document.getElementById('detail').classList.add('open');
            document.getElementById('detailTitle').textContent = note.title;
            document.getElementById('detailTitleInput').value = note.title;
            document.getElementById('detailContent').value = note.content || '';
            document.getElementById('detailRegion').value = note.region;
            
            const linkedNotes = connections
                .filter(c => c.from === note.id || c.to === note.id)
                .map(c => c.from === note.id ? c.to : c.from)
                .map(id => notes.find(n => n.id === id))
                .filter(Boolean);
            
            const linksContainer = document.getElementById('detailLinks');
            linksContainer.innerHTML = linkedNotes.map(n => 
                `<span class="detail-link" onclick="selectNoteById(${n.id})">${n.title}</span>`
            ).join('') || '<span style="font-size:10px;color:var(--text-dim)">No connections</span>';
            
            updateNotesList();
        }
        
        window.selectNoteById = function(id) {
            const note = notes.find(n => n.id === id);
            if (note) selectNote(note);
        };
        
        function closeDetail() {
            selectedNote = null;
            document.getElementById('detail').classList.remove('open');
            updateNotesList();
        }
        
        function handleSearch(query) {
            searchQuery = query.toLowerCase();
            updateNotesList();
            rebuildScene();
        }
        
        function filterByRegion(region) {
            filterRegion = filterRegion === region ? null : region;
            updateRegionsList();
            rebuildScene();
        }
        
        function updateRegionsList() {
            const container = document.getElementById('regions');
            container.innerHTML = '';
            
            Object.keys(REGIONS).forEach(key => {
                const r = REGIONS[key];
                const count = notes.filter(n => n.region === key).length;
                
                const div = document.createElement('div');
                div.className = 'region-item' + (filterRegion === key ? ' active' : '');
                div.innerHTML = `
                    <div class="region-dot" style="background:${r.c}"></div>
                    <div class="region-name">${r.name}</div>
                    <div class="region-count">${count}</div>
                `;
                div.onclick = () => filterByRegion(key);
                container.appendChild(div);
            });
        }
        
        function updateNotesList() {
            const container = document.getElementById('notes');
            container.innerHTML = '';
            
            let filtered = notes;
            
            if (filterRegion) {
                filtered = filtered.filter(n => n.region === filterRegion);
            }
            
            if (searchQuery) {
                filtered = filtered.filter(n => 
                    n.title.toLowerCase().includes(searchQuery) || 
                    (n.content && n.content.toLowerCase().includes(searchQuery))
                );
            }
            
            filtered.forEach(note => {
                const linkCount = connections.filter(c => c.from === note.id || c.to === note.id).length;
                
                const div = document.createElement('div');
                div.className = 'note-item' + (selectedNote?.id === note.id ? ' selected' : '');
                div.innerHTML = `
                    <div class="note-title">${note.title}</div>
                    <div class="note-preview">${note.content || 'No content'}</div>
                    <div class="note-links">${linkCount} connections</div>
                `;
                div.onclick = () => selectNote(note);
                container.appendChild(div);
            });
            
            document.getElementById('stats').textContent = `${notes.length} thoughts`;
        }
        
        function populateRegionSelect() {
            const select = document.getElementById('detailRegion');
            Object.keys(REGIONS).forEach(key => {
                const r = REGIONS[key];
                const opt = document.createElement('option');
                opt.value = key;
                opt.textContent = r.name;
                select.appendChild(opt);
            });
        }
        
        function createBrainOutline() {
            const group = new THREE.Group();
            
            Object.keys(REGIONS).forEach(key => {
                const r = REGIONS[key];
                const geo = new THREE.SphereGeometry(2.5, 16, 16);
                const mat = new THREE.MeshBasicMaterial({
                    color: r.c,
                    transparent: true,
                    opacity: 0.03,
                    wireframe: true
                });
                const mesh = new THREE.Mesh(geo, mat);
                mesh.position.set(r.x, r.y, r.z);
                group.add(mesh);
            });
            
            scene.add(group);
        }
        
        function createNoteMeshes() {
            notes.forEach(note => createNoteMesh(note));
        }
        
        function createNoteMesh(note) {
            const r = REGIONS[note.region];
            const mat = new THREE.MeshBasicMaterial({ color: r.c });
            const mesh = new THREE.Mesh(sphereGeo, mat);
            mesh.position.set(note.x, note.y, note.z);
            mesh.userData = { noteId: note.id };
            nodeMeshes.push(mesh);
            scene.add(mesh);
        }
        
        function computeAutoConnections() {
            connections = [];
            
            const notesByRegion = {};
            notes.forEach(n => {
                if (!notesByRegion[n.region]) notesByRegion[n.region] = [];
                notesByRegion[n.region].push(n);
            });
            
            Object.keys(notesByRegion).forEach(region => {
                const regionNotes = notesByRegion[region];
                regionNotes.forEach((noteA, i) => {
                    let connectionScore = 0;
                    
                    regionNotes.forEach((noteB, j) => {
                        if (i >= j) return;
                        
                        let score = 1;
                        
                        if (noteA.content && noteB.content) {
                            const wordsA = noteA.content.toLowerCase().split(/\s+/);
                            const wordsB = noteB.content.toLowerCase().split(/\s+/);
                            const common = wordsA.filter(w => w.length > 3 && wordsB.includes(w));
                            score += common.length * 2;
                        }
                        
                        if (i === 0 || j === 0 || connectionScore < 3) {
                            if (Math.random() < 0.15) score += 1;
                        }
                        
                        if (score >= 1) {
                            connections.push({ from: noteA.id, to: noteB.id, strength: score });
                            connectionScore++;
                        }
                    });
                });
            });
            
            const regionKeys = Object.keys(notesByRegion);
            for (let i = 0; i < regionKeys.length - 1; i++) {
                const r1Notes = notesByRegion[regionKeys[i]];
                const r2Notes = notesByRegion[regionKeys[i + 1]];
                if (r1Notes.length > 0 && r2Notes.length > 0) {
                    const hub1 = r1Notes[Math.floor(Math.random() * r1Notes.length)];
                    const hub2 = r2Notes[Math.floor(Math.random() * r2Notes.length)];
                    connections.push({ from: hub1.id, to: hub2.id, strength: 1 });
                }
            }
        }
        
        function rebuildScene() {
            nodeMeshes.forEach(m => scene.remove(m));
            nodeMeshes.length = 0;
            
            let filtered = notes;
            if (filterRegion) filtered = filtered.filter(n => n.region === filterRegion);
            if (searchQuery) filtered = filtered.filter(n => 
                n.title.toLowerCase().includes(searchQuery) || 
                (n.content && n.content.toLowerCase().includes(searchQuery))
            );
            
            const visibleIds = new Set(filtered.map(n => n.id));
            
            filtered.forEach(note => createNoteMesh(note));
        }
        
        function onCanvasClick(e) {
            const raycaster = new THREE.Raycaster();
            const mouse = new THREE.Vector2(
                (e.clientX / window.innerWidth) * 2 - 1,
                -(e.clientY / window.innerHeight) * 2 + 1
            );
            raycaster.setFromCamera(mouse, camera);
            
            const hits = raycaster.intersectObjects(nodeMeshes);
            if (hits.length > 0) {
                const noteId = hits[0].object.userData.noteId;
                const note = notes.find(n => n.id === noteId);
                if (note) selectNote(note);
            }
        }
        
        let connectionMesh = null;
        
        function loop() {
            camera.position.x = 25 * Math.sin(rotY) * Math.cos(rotX);
            camera.position.y = 25 * Math.sin(rotX);
            camera.position.z = 25 * Math.cos(rotY) * Math.cos(rotX);
            camera.lookAt(0, 0, -1);
            
            if (connectionMesh) {
                scene.remove(connectionMesh);
                connectionMesh.geometry.dispose();
            }
            
            const positions = [];
            connections.forEach(c => {
                const a = notes.find(n => n.id === c.from);
                const b = notes.find(n => n.id === c.to);
                if (a && b) {
                    positions.push(a.x, a.y, a.z);
                    positions.push(b.x, b.y, b.z);
                }
            });
            
            if (positions.length > 0) {
                const geo = new THREE.BufferGeometry();
                geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
                const mat = new THREE.LineBasicMaterial({ color: 0x333344, transparent: true, opacity: 0.15 });
                connectionMesh = new THREE.LineSegments(geo, mat);
                scene.add(connectionMesh);
            }
            
            renderer.render(scene, camera);
            requestAnimationFrame(loop);
        }
        
        window.createNote = createNote;
        window.handleSearch = handleSearch;
        window.updateCurrentNote = updateCurrentNote;
        window.deleteCurrentNote = deleteCurrentNote;
        window.closeDetail = closeDetail;
        
        init();
