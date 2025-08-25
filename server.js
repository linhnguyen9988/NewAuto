const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 4000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let addressData = [];
let sortedKnownWardNamesCache = [];
let wardInvertedIndex = new Map();

const DEBUG_MODE = true;

const commonPrefixesAndStopWords = [
    'duong', 'dg',
    'kp', 'khu pho',
    'so', 'nha',
    'ngo', 'pho',
    'hem', 'ngach',
    'khom', 'ap', 'thon', 'lang', 'to',
    'o', 'tai', 'khu', 'giai', 'thua',
    'chung cu', 'chungcư', 'chung', 'cu',
    'opal', 'lo', 'b',
    'block', 'tang', 'can ho',
    'uy ban nhan dan',
    'uy ban',
];

const adminPrefixes = [
    'phuong', 'p',
    'xa',
    'thi tran', 'tt',
    'quan', 'q',
    'huyen',
    'thi xa', 'tx',
    'thanh pho', 'tp',
    'tinh',
];

const wardAdminPrefixesWords = ['phuong', 'p', 'xa', 'thi tran', 'tt'];
const higherAdminPrefixesWords = [
    'quan', 'q', 'huyen', 'thi xa', 'tx', 'thanh pho', 'tp', 'tinh',
];
const streetRelatedWords = [
    'duong', 'dg',
    'ngo', 'so', 'nha', 'pho', 'khu pho', 'kp', 'hem', 'ngach', 'khom', 'ap', 'thon', 'lang', 'to',
];


function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function removeVietnameseDiacritics(str) {
    if (!str) return '';
    str = str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    str = str.replace(/đ/g, "d").replace(/Đ/g, "D");
    return str;
}

function normalizeString(str) {
    if (!str) return '';
    const originalStr = str;
    str = str.normalize("NFD");
    str = str.replace(/[\u0300-\u036f]/g, "");
    str = str.replace(/đ/g, "d").replace(/Đ/g, "D");
    str = str.toLowerCase();

    str = str.replace(/\bthanh pho\s*ho chi minh\b/g, 'ho chi minh');
    str = str.replace(/\btp\s*hcm\b/g, 'ho chi minh');
    str = str.replace(/\btphcm\b/g, 'ho chi minh');
    str = str.replace(/\btp\.hcm\b/g, 'ho chi minh');
    str = str.replace(/\bsai gon\b/g, 'ho chi minh');
    str = str.replace(/\bbien hoa\b/g, 'bien hoa');
    str = str.replace(/\bdong nai\b/g, 'dong nai');
    str = str.replace(/\bong nai\b/g, 'dong nai');
    str = str.replace(/\bvung tau\b/g, 'vung tau');
    str = str.replace(/\bba ria vung tau\b/g, 'ba ria vung tau');
    str = str.replace(/\bbinh duong\b/g, 'binh duong');
    str = str.replace(/\bquy nhon\b/g, 'quy nhon');
    str = str.replace(/\bqui nhon\b/g, 'quy nhon');
    str = str.replace(/\bkon tum\b/g, 'kon tum');
    str = str.replace(/\bkontum\b/g, 'kon tum');
    str = str.replace(/\brach gia\b/g, 'rach gia');
    str = str.replace(/\bkien giang\b/g, 'kien giang');
    str = str.replace(/\bvinh\b/g, 'vinh');
    str = str.replace(/\bnghe an\b/g, 'nghe an');
    str = str.replace(/\btien giang\b/g, 'tien giang');
    str = str.replace(/\ban giang\b/g, 'an giang');
    str = str.replace(/\bbinh inh\b/g, 'binh dinh');
    str = str.replace(/\bbinh dinh\b/g, 'binh dinh');
    str = str.replace(/\bbmt\b/g, 'buon ma thuot');

    str = str.replace(/\bda m'ri\b/g, 'da mri');
    str = str.replace(/\bda mri\b/g, 'da mri');
    str = str.replace(/\bdam ri\b/g, 'da mri');
    if (str.includes('phan rang') || str.includes('ninh thuan')) {
        str = str.replace(/\bmy huong\b/g, 'mi huong');
        str = str.replace(/\bmy binh\b/g, 'mi binh');
        str = str.replace(/\bmy hai\b/g, 'mi hai');
        str = str.replace(/\bmy dong\b/g, 'mi dong');
        str = str.replace(/\bphuoc my\b/g, 'phuoc mi');
    }
    
    if (str.includes('cai lay') || str.includes('tien giang')) {
        str = str.replace(/\bnhi my\b/g, 'nhi mi');
    }
    if (str.includes('gio linh') || str.includes('quang tri')) {
        str = str.replace(/\bgio my\b/g, 'gio mi');
    }
    if (str.includes('chau thanh') || str.includes('kien giang')) {
        str = str.replace(/\bduc tuong\b/g, 'giuc tuong');
    }
    str = str.replace(/\bphan rang thap cham\b/g, 'phan rang thap cham');
    str = str.replace(/\bphan rang\b/g, 'phan rang');
    str = str.replace(/\bninh thuan\b/g, 'ninh thuan');

    str = str.replace(/\bp(\d+)\b/g, 'phuong $1');
    str = str.replace(/\bq(\d+)\b/g, 'quan $1');
    str = str.replace(/\bf(\d+)\b/g, 'phuong $1');

    str = str.replace(/\bthanh pho\b/g, 'thanh pho');
    str = str.replace(/\btinh\b/g, 'tinh');
    str = str.replace(/\bhuyen\b/g, 'huyen');
    str = str.replace(/\bxa\b/g, 'xa');
    str = str.replace(/\bquan\b/g, 'quan');
    str = str.replace(/\bphuong\b/g, 'phuong');
    str = str.replace(/\btp\b/g, 'thanh pho');
    str = str.replace(/\bthi xa\b/g, 'thi xa');
    str = str.replace(/\btx\b/g, 'thi xa');
    str = str.replace(/\bthi tran\b/g, 'thi tran');
    str = str.replace(/\btp\b/g, 'thanh pho');
    str = str.replace(/\btp\.hcm\b/g, 'ho chi minh');
    str = str.replace(/\btt\b/g, 'thi tran');

    if (str.includes('binh tan') && (str.includes('hcm') || str.includes('ho chi minh'))) {
        str = str.replace(/\bbinh tan\b/g, 'quan binh tan');
    } else if (str.includes('binh tan') && (str.includes('binh thuan') || str.includes('bac binh'))) {
        str = str.replace(/\bbinh tan\b/g, 'xa binh tan');
    }

    str = str.replace(/\bdak nong\b/g, 'dak nong');
    str = str.replace(/\bcu jut\b/g, 'cu jut');
    str = str.replace(/\bea t'ling\b/g, 'ea tling');

    str = str.replace(/[^a-z0-9\s]/g, ' ');
    str = str.replace(/\s+/g, ' ').trim();

    if (str.includes('go vap') || str.includes('gv') || str.includes('qgv')) {
        if (!/p1./.test(str)) {
            str = str.replace(/\bp.1\b/g, 'phuong 01');
            str = str.replace(/\bp1\b/g, 'phuong 01');
            str = str.replace(/\bf1\b/g, 'phuong 01');
            str = str.replace(/\bp 1\b/g, 'phuong 01');
            str = str.replace(/\bf 1\b/g, 'phuong 01');
            str = str.replace(/\bphuong 1\b/g, 'phuong 01');
        }
        str = str.replace(/\bp.3\b/g, 'phuong 03');
        str = str.replace(/\bp3\b/g, 'phuong 03');
        str = str.replace(/\bf3\b/g, 'phuong 03');
        str = str.replace(/\bp 3\b/g, 'phuong 03');
        str = str.replace(/\bf 3\b/g, 'phuong 03');
        str = str.replace(/\bphuong 3\b/g, 'phuong 03');

        str = str.replace(/\bp.4\b/g, 'phuong 04');
        str = str.replace(/\bp4\b/g, 'phuong 04');
        str = str.replace(/\bf4\b/g, 'phuong 04');
        str = str.replace(/\bp 4\b/g, 'phuong 04');
        str = str.replace(/\bf 4\b/g, 'phuong 04');
        str = str.replace(/\bphuong 4\b/g, 'phuong 04');

        str = str.replace(/\bp.5\b/g, 'phuong 05');
        str = str.replace(/\bp5\b/g, 'phuong 05');
        str = str.replace(/\bf5\b/g, 'phuong 05');
        str = str.replace(/\bp 5\b/g, 'phuong 05');
        str = str.replace(/\bf 5\b/g, 'phuong 05');
        str = str.replace(/\bphuong 5\b/g, 'phuong 05');

        str = str.replace(/\bp.7\b/g, 'phuong 07');
        str = str.replace(/\bp7\b/g, 'phuong 07');
        str = str.replace(/\bf7\b/g, 'phuong 07');
        str = str.replace(/\bp 7\b/g, 'phuong 07');
        str = str.replace(/\bf 7\b/g, 'phuong 07');
        str = str.replace(/\bphuong 7\b/g, 'phuong 07');
    }

    return str;
}

const getCleanAddressName = (fullAddressName) => {
    if (!fullAddressName) return '';
    let cleanName = removeVietnameseDiacritics(fullAddressName).toLowerCase();

    cleanName = cleanName.replace(/-\s*[a-z0-9]+$/g, '');
    cleanName = cleanName.replace(/\([^)]+\)/g, '');

    const prefixesToRemove = ['phuong ', 'xa ', 'thi tran ', 'quan ', 'huyen ', 'thi xa ', 'thanh pho ', 'tinh '];
    for (const prefix of prefixesToRemove) {
        if (cleanName.startsWith(prefix)) {
            cleanName = cleanName.substring(prefix.length);
            break;
        }
    }

    cleanName = cleanName.replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

    return cleanName;
};

function getCoreNameForMatch(str) {
    if (!str) return '';
    let name = getCleanAddressName(str);

    if (name.includes('ho chi minh')) return 'ho chi minh';
    if (name.includes('ba ria vung tau')) return 'ba ria vung tau';
    if (name.includes('vung tau')) return 'vung tau';
    if (name.includes('bien hoa')) return 'bien hoa';
    if (name.includes('dong nai')) return 'dong nai';
    if (name.includes('quy nhon')) return 'quy nhon';
    if (name.includes('hon dat')) return 'hon dat';
    if (name.includes('long binh tan')) return 'long binh tan';
    if (name.includes('long binh')) return 'long binh';
    if (name.includes('thanh hoa')) return 'thanh hoa';
    if (name.includes('hoa binh')) return 'hoa binh';
    if (name.includes('kon tum')) return 'kon tum';
    if (name.includes('di an')) return 'di an';
    if (name.includes('an binh')) return 'an binh';
    if (name.includes('rach gia')) return 'rach gia';
    if (name.includes('kien giang')) return 'kien giang';
    if (name.includes('vinh thanh van')) return 'vinh thanh van';
    if (name.includes('vinh')) return 'vinh';
    if (name.includes('nghe an')) return 'nghe an';
    if (name.includes('quang trung')) return 'quang trung';
    if (name.includes('tien giang')) return 'tien giang';
    if (name.includes('chau thanh')) return 'chau thanh';
    if (name.includes('vinh kim')) return 'vinh kim';
    if (name.includes('mi duc')) return 'mi duc';
    if (name.includes('buon ma thuot')) return 'buon ma thuot';
    if (name.includes('da mri')) return 'da mri';
    if (name.includes('phan rang thap cham')) return 'phan rang thap cham';
    if (name.includes('phan rang')) return 'phan rang';
    if (name.includes('ninh thuan')) return 'ninh thuan';
    if (name.includes('binh tan')) return 'binh tan';
    if (name.includes('dak nong')) return 'dak nong';
    if (name.includes('cu jut')) return 'cu jut';
    if (name.includes('ea tling')) return 'ea tling';
    if (name.includes('ea m nang')) return 'ea m nang';
    if (name.includes('cu m gar')) return 'cu m gar';

    return name;
}

const allCleanedAdminNames = {
    wards: new Map(),
    districts: new Set(),
    provinces: new Set(),
    allHigherAdmin: new Set()
};

function testPhraseWithWordBoundaries(text, phrase) {
    if (!text || !phrase) {
        return false;
    }
    const escapedPhrase = escapeRegExp(phrase);
    // Use \b for true word boundary matching
    const regex = new RegExp(`\\b${escapedPhrase}\\b`, 'gi');
    return regex.test(text);
}


function getUserWardPhrase(userInputNormalized) {
    const allStopWordsAndAdminUnits = new Set([
        ...adminPrefixes,
        ...commonPrefixesAndStopWords,
        ...streetRelatedWords,
        normalizeString('an duong'), normalizeString('hai phong'), normalizeString('bien hoa'), normalizeString('dong nai'),
        normalizeString('bac ninh'), normalizeString('phan thiet'), normalizeString('binh thuan'),
        normalizeString('duyen hai'), normalizeString('tra vinh'), normalizeString('huong hoa'),
        normalizeString('quang tri'), normalizeString('chon thanh'), normalizeString('binh phuoc'),
        normalizeString('ho chi minh'), normalizeString('quan 10'), normalizeString('le chan'),
        normalizeString('kien thuy'), normalizeString('nghi loc'), normalizeString('tuong duong'),
        normalizeString('my hao'), normalizeString('hung yen'), normalizeString('vinh'),
        normalizeString('nghe an'),
        normalizeString('thoai son'), normalizeString('an giang'),
        normalizeString('huyen thoai son'), normalizeString('tinh an giang'),
        normalizeString('thanh pho bac ninh'), normalizeString('bac ninh'),
        normalizeString('thanh pho bien hoa'), normalizeString('bien hoa'),
        normalizeString('dong nai'), normalizeString('quang tri'), 'huong hoa',
        normalizeString('phu giao'), normalizeString('binh duong'),
        normalizeString('an lao'), normalizeString('binh dinh'),
        normalizeString('lien khu'),
        normalizeString('binh chanh'),
        normalizeString('buon ma thuot'),
        normalizeString('dak lak'),
        normalizeString('da mri'),
        normalizeString('phan rang'),
        normalizeString('ninh thuan'),
        normalizeString('binh tan'),
        // <<< CHỈNH SỬA TẠI ĐÂY: Thêm "dak nong" và "cu jut" vào stop words và admin units để tránh nhầm lẫn
        normalizeString('dak nong'),
        normalizeString('cu jut'),
        // >>> HẾT PHẦN CHỈNH SỬA
    ]);

    const userInputWordsArray = userInputNormalized.split(/\s+/).filter(Boolean);
    let potentialWardPhrasesWithScores = [];

    let identifiedHigherAdminPhrase = null;
    let highestAdminScore = 0; // Not used directly for selection, but as a general indicator

    const allSortedHigherAdminNames = Array.from(allCleanedAdminNames.allHigherAdmin).sort((a, b) => b.length - a.length);
    for (const adminName of allSortedHigherAdminNames) {
        // Only consider if the higher admin name is explicitly prefixed in the input
        let foundPrefixedHigherAdmin = false;
        for (const prefix of higherAdminPrefixesWords) {
            const prefixedAdminName = `${prefix} ${adminName}`;
            if (testPhraseWithWordBoundaries(userInputNormalized, prefixedAdminName)) {
                identifiedHigherAdminPhrase = adminName; // Store the cleaned name
                highestAdminScore = prefixedAdminName.length * 100000000; // Strong score
                foundPrefixedHigherAdmin = true;
                break;
            }
        }
        // Also check if the higher admin name is present in input AND it's a known district/province
        if (!foundPrefixedHigherAdmin &&
            (allCleanedAdminNames.districts.has(adminName) || allCleanedAdminNames.provinces.has(adminName)) &&
            testPhraseWithWordBoundaries(userInputNormalized, adminName)) {
            identifiedHigherAdminPhrase = adminName; // Store the cleaned name
            highestAdminScore = adminName.length * 50000000; // Strong score, but less than prefixed
            foundPrefixedHigherAdmin = true;
        }

        if (foundPrefixedHigherAdmin) {
            break; // Found the best prefixed higher admin, no need to check smaller ones
        }
    }

    if (DEBUG_MODE) {
        console.log("Trích xuất cụm từ hành chính cấp cao từ input (identifiedHigherAdminPhrase):", identifiedHigherAdminPhrase);
    }

    let relevantWardCandidates = new Set();
    if (userInputWordsArray.length > 0) {
        // Build candidate list based on inverted index for efficiency
        let initialCandidates = new Set();
        if (wardInvertedIndex.has(userInputWordsArray[0])) {
            initialCandidates = new Set(wardInvertedIndex.get(userInputWordsArray[0]));
        }

        if (initialCandidates.size > 0) {
            relevantWardCandidates = new Set([...initialCandidates]);
            for (let i = 1; i < userInputWordsArray.length; i++) {
                const currentWord = userInputWordsArray[i];
                const wardsForCurrentWord = wardInvertedIndex.get(currentWord);

                if (!wardsForCurrentWord) {
                    relevantWardCandidates.clear(); // No common ward found if a word is missing
                    break;
                }
                relevantWardCandidates = new Set([...relevantWardCandidates].filter(x => wardsForCurrentWord.has(x)));
                if (relevantWardCandidates.size === 0) {
                    break;
                }
            }
        }
    }

    const wardsToProcess = relevantWardCandidates.size > 0 ? Array.from(relevantWardCandidates).sort((a, b) => b.length - a.length) : sortedKnownWardNamesCache;

    if (DEBUG_MODE && relevantWardCandidates.size > 0) {
        console.log(`Đã lọc danh sách phường/xã để xử lý xuống ${relevantWardCandidates.size} mục bằng index.`);
    } else if (DEBUG_MODE) {
        console.log("Không tìm thấy phường/xã cụ thể bằng index, đang duyệt toàn bộ cache.");
    }


    for (const knownWard of wardsToProcess) {
        let currentScore = 0;
        let foundMatchForWard = false;
        let isExplicitlyPrefixedAsWard = false;

        const cleanWardNameInDB = getCleanAddressName(knownWard);

        // Strongest signal: exact match with an explicit prefix (e.g., "xa nguyen huan")
        for (const prefix of wardAdminPrefixesWords) {
            const prefixedKnownWard = `${prefix} ${cleanWardNameInDB}`; // Use cleanWardNameInDB here
            if (testPhraseWithWordBoundaries(userInputNormalized, prefixedKnownWard)) {
                currentScore = 2000000000; // Extremely high score for explicit match
                isExplicitlyPrefixedAsWard = true;
                foundMatchForWard = true;
                break;
            }
        }

        // Second strongest: direct match of the cleaned ward name (especially multi-word, not higher admin)
        if (!foundMatchForWard && testPhraseWithWordBoundaries(userInputNormalized, cleanWardNameInDB)) {
            const wordsInCleanWard = cleanWardNameInDB.split(/\s+/).filter(Boolean);
            if (wordsInCleanWard.length > 1 &&
                !allCleanedAdminNames.districts.has(cleanWardNameInDB) &&
                !allCleanedAdminNames.provinces.has(cleanWardNameInDB)) {
                // This is a multi-word ward name that is not also a district/province
                currentScore = 1500000000; // Very very high score, almost as good as explicitly prefixed
                foundMatchForWard = true;
            } else {
                // Single word ward or ward that is also a district/province
                currentScore = cleanWardNameInDB.length * 500000;
                foundMatchForWard = true;
            }
        }

        // Handle numeric wards like "phuong 1" if only "1" is in input
        if (!isExplicitlyPrefixedAsWard && /^\d+$/.test(cleanWardNameInDB)) { // Use cleanWardNameInDB here
            if (testPhraseWithWordBoundaries(userInputNormalized, cleanWardNameInDB)) {
                potentialWardPhrasesWithScores.push({ phrase: knownWard, score: 100, isExplicitlyPrefixedAsWard: isExplicitlyPrefixedAsWard });
            }
            continue; // Skip further checks for pure numeric wards for now if not explicitly prefixed
        }

        // <<< CHỈNH SỬA TẠI ĐÂY: Logic ưu tiên và phạt dựa trên ngữ cảnh hành chính cấp cao trong getUserWardPhrase
        // Contextual consistency with identified higher admin phrase
        if (identifiedHigherAdminPhrase) {
            const associatedItemsForWard = allCleanedAdminNames.wards.get(cleanWardNameInDB);
            let isWardConsistentWithHigherAdmin = false;
            if (associatedItemsForWard) {
                for (const itemOfWard of associatedItemsForWard) {
                    const normalizedItemOfWardDistrict = normalizeString(getCleanAddressName(itemOfWard.district));
                    const normalizedItemOfWardProvince = normalizeString(getCleanAddressName(itemOfWard.province));

                    if ((normalizedItemOfWardDistrict && testPhraseWithWordBoundaries(identifiedHigherAdminPhrase, normalizedItemOfWardDistrict)) ||
                        (normalizedItemOfWardProvince && testPhraseWithWordBoundaries(identifiedHigherAdminPhrase, normalizedItemOfWardProvince)) ||
                        (normalizedItemOfWardDistrict && testPhraseWithWordBoundaries(normalizedItemOfWardDistrict, identifiedHigherAdminPhrase)) ||
                        (normalizedItemOfWardProvince && testPhraseWithWordBoundaries(normalizedItemOfWardProvince, identifiedHigherAdminPhrase))) {
                        isWardConsistentWithHigherAdmin = true;
                        break;
                    }
                }
            }
            if (!isWardConsistentWithHigherAdmin && foundMatchForWard && !isExplicitlyPrefixedAsWard) {
                // Penalize heavily if the ward matches but is inconsistent with the *identified* higher admin, and not explicitly prefixed
                currentScore = Math.max(currentScore - 5000000000, 0); // Very large penalty
                foundMatchForWard = false; // Effectively disqualify if highly inconsistent
            } else if (isWardConsistentWithHigherAdmin && foundMatchForWard) {
                currentScore += 100000000; // Bonus if consistent
            }
        }

        // Penalize if a ward name is also a higher admin unit and not explicitly prefixed as a ward, unless there's clear contextual support
        let isAlsoHigherAdminUnit = false;
        if (allCleanedAdminNames.districts.has(cleanWardNameInDB) || allCleanedAdminNames.provinces.has(cleanWardNameInDB)) {
            isAlsoHigherAdminUnit = true;
        }

        if (!isExplicitlyPrefixedAsWard && isAlsoHigherAdminUnit) {
            let isContextuallyClearWard = false;
            const associatedItemsForWard = allCleanedAdminNames.wards.get(cleanWardNameInDB);
            if (associatedItemsForWard) {
                for (const itemOfWard of associatedItemsForWard) {
                    const normalizedFullDistrict = normalizeString(itemOfWard.district);
                    const cleanedDistrict = normalizeString(getCleanAddressName(itemOfWard.district));
                    const normalizedFullProvince = normalizeString(getCleanAddressName(itemOfWard.province));
                    const cleanedProvince = normalizeString(getCleanAddressName(itemOfWard.province));

                    const districtMatch = (normalizedFullDistrict && testPhraseWithWordBoundaries(userInputNormalized, normalizedFullDistrict)) ||
                        (cleanedDistrict && testPhraseWithWordBoundaries(userInputNormalized, cleanedDistrict));
                    const provinceMatch = (normalizedFullProvince && testPhraseWithWordBoundaries(userInputNormalized, normalizedFullProvince)) ||
                        (cleanedProvince && testPhraseWithWordBoundaries(userInputNormalized, cleanedProvince));
                    if (districtMatch || provinceMatch) { // If either district or province matches, it's contextually clear
                        isContextuallyClearWard = true;
                        break;
                    }
                }
            }

            if (!isContextuallyClearWard) {
                if (foundMatchForWard) {
                    currentScore = Math.max(currentScore - 500000000, 100); // Significant penalty
                } else {
                    currentScore = 1; // Almost discard
                }
            }
        }
        // >>> HẾT PHẦN CHỈNH SỬA

        // Partial contiguous word matching for less strong ward matches
        if (!foundMatchForWard) {
            const knownWardWords = cleanWardNameInDB.split(/\s+/).filter(Boolean);
            let bestContiguousPartialMatch = '';

            for (let i = 0; i < knownWardWords.length; i++) {
                for (let j = i; j < knownWardWords.length; j++) {
                    const currentContiguousPhrase = knownWardWords.slice(i, j + 1).join(' ');
                    if (currentContiguousPhrase.length > 0 && testPhraseWithWordBoundaries(userInputNormalized, currentContiguousPhrase)) {
                        if (currentContiguousPhrase.length > bestContiguousPartialMatch.length) {
                            bestContiguousPartialMatch = currentContiguousPhrase;
                        }
                    }
                }
            }

            if (bestContiguousPartialMatch.length > 0) {
                currentScore += bestContiguousPartialMatch.length * 5000;
                foundMatchForWard = true;
            }
        }

        // Add contextual bonus based on district/province matches *if* a ward match (even partial) was found
        if (foundMatchForWard && currentScore >= 100) {
            const associatedItemsForWard = allCleanedAdminNames.wards.get(cleanWardNameInDB);
            if (associatedItemsForWard) {
                let bestContextualBonus = 0;
                for (const itemOfWard of associatedItemsForWard) {
                    let contextualBonus = 0;
                    const normalizedFullDistrict = normalizeString(itemOfWard.district);
                    const cleanedDistrict = normalizeString(getCleanAddressName(itemOfWard.district));
                    const normalizedFullProvince = normalizeString(getCleanAddressName(itemOfWard.province));
                    const cleanedProvince = normalizeString(getCleanAddressName(itemOfWard.province));

                    const districtMatch = (normalizedFullDistrict && testPhraseWithWordBoundaries(userInputNormalized, normalizedFullDistrict)) ||
                        (cleanedDistrict && testPhraseWithWordBoundaries(userInputNormalized, cleanedDistrict));
                    const provinceMatch = (normalizedFullProvince && testPhraseWithWordBoundaries(userInputNormalized, normalizedFullProvince)) ||
                        (cleanedProvince && testPhraseWithWordBoundaries(userInputNormalized, cleanedProvince));
                    if (districtMatch) {
                        contextualBonus += 10000;
                    }
                    if (provinceMatch) {
                        contextualBonus += 20000;
                    }
                    bestContextualBonus = Math.max(bestContextualBonus, contextualBonus);
                }
                currentScore += bestContextualBonus;
            }
            if (cleanWardNameInDB.split(/\s+/).filter(Boolean).length > 1) {
                currentScore += 5000;
            }
        }


        if (foundMatchForWard && currentScore > 0) {
            potentialWardPhrasesWithScores.push({ phrase: knownWard, score: currentScore, isExplicitlyPrefixedAsWard: isExplicitlyPrefixedAsWard });
        }
    }

    // Sort potential ward phrases: highest score first, then by explicit prefix, then pure ward names, then length, then multi-word, then alphabetically
    potentialWardPhrasesWithScores.sort((a, b) => {
        if (b.score !== a.score) {
            return b.score - a.score;
        }
        if (a.isExplicitlyPrefixedAsWard && !b.isExplicitlyPrefixedAsWard) return -1;
        if (b.isExplicitlyPrefixedAsWard && !a.isExplicitlyPrefixedAsWard) return 1;

        const aIsPureWard = allCleanedAdminNames.wards.has(getCleanAddressName(a.phrase)) && !allCleanedAdminNames.districts.has(getCleanAddressName(a.phrase)) && !allCleanedAdminNames.provinces.has(getCleanAddressName(a.phrase));
        const bIsPureWard = allCleanedAdminNames.wards.has(getCleanAddressName(b.phrase)) && !allCleanedAdminNames.districts.has(getCleanAddressName(b.phrase)) && !allCleanedAdminNames.provinces.has(getCleanAddressName(b.phrase));

        if (aIsPureWard && !bIsPureWard) return -1;
        if (bIsPureWard && !aIsPureWard) return 1;

        if (b.phrase.length !== a.phrase.length) {
            return b.phrase.length - a.phrase.length;
        }

        const aIsMultiWord = getCleanAddressName(a.phrase).split(/\s+/).filter(Boolean).length > 1;
        const bIsMultiWord = getCleanAddressName(b.phrase).split(/\s+/).filter(Boolean).length > 1;
        if (aIsMultiWord !== bIsMultiWord) {
            return bIsMultiWord - aIsMultiWord; // Prioritize multi-word phrases if scores and other criteria are equal
        }

        return a.phrase.localeCompare(b.phrase);
    });

    let wardPhrase = null;
    let isWardPhraseExplicitlyPrefixed = false;

    // Select the best ward phrase
    if (potentialWardPhrasesWithScores.length > 0) {
        wardPhrase = potentialWardPhrasesWithScores[0].phrase;
        isWardPhraseExplicitlyPrefixed = potentialWardPhrasesWithScores[0].isExplicitlyPrefixedAsWard;
    } else {
        // Fallback for generic phrases if no strong ward match
        let bestGenericFallbackPhrase = null;
        let bestGenericFallbackScore = -1;
        for (let i = 0; i < userInputWordsArray.length; i++) {
            for (let j = i; j < userInputWordsArray.length; j++) {
                const currentPhrase = userInputWordsArray.slice(i, j + 1).join(' ');
                // Exclude very short phrases, pure numbers, and known stop words/admin units
                if (currentPhrase.length < 2 || /^\d+$/.test(currentPhrase) || allStopWordsAndAdminUnits.has(currentPhrase)) {
                    continue;
                }
                // Avoid using higher admin units as fallback ward phrase
                if (allCleanedAdminNames.wards.has(currentPhrase) ||
                    allCleanedAdminNames.districts.has(currentPhrase) ||
                    allCleanedAdminNames.provinces.has(currentPhrase)) {
                    continue; // Skip if it's already a known admin unit
                }

                let score = currentPhrase.length * 10;
                if (score > bestGenericFallbackScore) {
                    bestGenericFallbackScore = score;
                    bestGenericFallbackPhrase = currentPhrase;
                }
            }
        }
        wardPhrase = bestGenericFallbackPhrase;
    }

    return { wardPhrase: wardPhrase, higherAdminPhrase: identifiedHigherAdminPhrase, isWardPhraseExplicitlyPrefixed: isWardPhraseExplicitlyPrefixed };
}

fs.readFile(path.join(__dirname, 'addresses.json'), 'utf8', (err, data) => {
    if (err) {
        console.error("Error reading addresses data file:", err);
        process.exit(1);
    }
    try {
        addressData = JSON.parse(data);
        console.log(`Loaded ${addressData.length} address records.`);

        addressData.forEach(item => {
            const cleanWard = normalizeString(getCleanAddressName(item.ward));
            const normalizedFullDistrict = normalizeString(item.district);
            const cleanedDistrict = normalizeString(getCleanAddressName(item.district));
            const normalizedFullProvince = normalizeString(item.province);
            const cleanedProvince = normalizeString(getCleanAddressName(item.province));

            if (cleanWard) {
                if (!allCleanedAdminNames.wards.has(cleanWard)) {
                    allCleanedAdminNames.wards.set(cleanWard, new Set());
                }
                allCleanedAdminNames.wards.get(cleanWard).add(item);

                const wordsInCleanWard = cleanWard.split(/\s+/).filter(Boolean);
                wordsInCleanWard.forEach(word => {
                    if (!wardInvertedIndex.has(word)) {
                        wardInvertedIndex.set(word, new Set());
                    }
                    wardInvertedIndex.get(word).add(cleanWard);
                });
            }
            if (normalizedFullDistrict) {
                allCleanedAdminNames.districts.add(normalizedFullDistrict);
                allCleanedAdminNames.districts.add(cleanedDistrict);
                allCleanedAdminNames.allHigherAdmin.add(normalizedFullDistrict);
                allCleanedAdminNames.allHigherAdmin.add(cleanedDistrict);
            }
            if (normalizedFullProvince) {
                allCleanedAdminNames.provinces.add(normalizedFullProvince);
                allCleanedAdminNames.provinces.add(cleanedProvince);
                allCleanedAdminNames.allHigherAdmin.add(normalizedFullProvince);
                allCleanedAdminNames.allHigherAdmin.add(cleanedProvince);
            }
        });

        sortedKnownWardNamesCache = Array.from(allCleanedAdminNames.wards.keys()).sort((a, b) => b.length - a.length);

    } catch (parseErr) {
        console.error("Error parsing addresses data JSON:", parseErr);
        process.exit(1);
    }
});

app.post('/api/identify-location', (req, res) => {
    console.time('processAddress');

    if (DEBUG_MODE) {
        console.log("\n--- Bắt đầu xử lý yêu cầu mới ---");
        console.log("Input gốc của người dùng:", req.body.text);
    }

    const userInputRaw = req.body.text;
    if (!userInputRaw) {
        if (DEBUG_MODE) {
            console.log("Input trống, trả về lỗi 400.");
            console.log("--- Kết thúc xử lý yêu cầu mới ---\n");
        }
        console.timeEnd('processAddress');
        return res.status(400).json({ success: false, message: "Vui lòng nhập địa chỉ." });
    }

    console.time('normalizeUserInput');
    const normalizedUserInput = normalizeString(userInputRaw);
    console.timeEnd('normalizeUserInput');

    if (DEBUG_MODE) {
        console.log("Input người dùng đã chuẩn hóa (Final):", normalizedUserInput);
    }

    const userInputWords = normalizedUserInput.replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').split(' ').filter(Boolean);

    let userInputCoreWords = [];
    userInputWords.forEach(word => {
        if (word.length > 0 && !adminPrefixes.includes(word) && !commonPrefixesAndStopWords.includes(word)) {
            userInputCoreWords.push(word);
        }
    });

    const addIfPresent = (phrase, wordsToAdd) => {
        if (normalizedUserInput.includes(phrase)) {
            wordsToAdd.forEach(w => {
                if (!userInputCoreWords.includes(w)) {
                    userInputCoreWords.push(w);
                }
            });
        }
    };
    addIfPresent('ho chi minh', ['ho', 'chi', 'minh']);
    addIfPresent('bien hoa', ['bien', 'hoa']);
    addIfPresent('dong nai', ['dong', 'nai']);
    addIfPresent('kon tum', ['kon', 'tum']);
    addIfPresent('kontum', ['kon', 'tum']);
    addIfPresent('di an', ['di', 'an']);
    addIfPresent('an binh', ['an', 'binh']);
    addIfPresent('rach gia', ['rach', 'gia']);
    addIfPresent('kien giang', ['kien', 'giang']);
    addIfPresent('vinh thanh van', ['vinh', 'thanh', 'van']);
    addIfPresent('vinh', ['vinh']);
    addIfPresent('nghe an', ['nghe', 'an']);
    addIfPresent('quang trung', ['quang', 'trung']);
    addIfPresent('tien giang', ['tien', 'giang']);
    addIfPresent('chau thanh', ['chau', 'thanh']);
    addIfPresent('vinh kim', ['vinh', 'kim']);
    addIfPresent('mi duc', ['mi', 'duc']);
    addIfPresent('long thoi', ['long', 'thoi']);
    addIfPresent('an thanh', ['an', 'thanh']);
    addIfPresent('thoai son', ['thoai', 'son']);
    addIfPresent('an giang', ['an', 'giang']);
    addIfPresent('an lao', ['an', 'lao']);
    addIfPresent('binh dinh', ['binh', 'dinh']);
    addIfPresent('buon ma thuot', ['buon', 'ma', 'thuot']);
    addIfPresent('dak lak', ['dak', 'lak']);
    addIfPresent('da mri', ['da', 'mri']);
    addIfPresent('phan rang', ['phan', 'rang']);
    addIfPresent('ninh thuan', ['ninh', 'thuan']);
    addIfPresent('binh tan', ['binh', 'tan']);
    addIfPresent('binh thuan', ['binh', 'thuan']);

    // <<< CHỈNH SỬA TẠI ĐÂY: Thêm "dak nong" và "cu jut" vào userInputCoreWords
    addIfPresent('dak nong', ['dak', 'nong']);
    addIfPresent('cu jut', ['cu', 'jut']);
    addIfPresent('ea tling', ['ea', 'tling']); // Thêm Ea T'Ling
    // >>> HẾT PHẦN CHỈNH SỬA

    userInputCoreWords = Array.from(new Set(userInputCoreWords));
    if (DEBUG_MODE) {
        console.log("Các từ cốt lõi từ input người dùng:", userInputCoreWords);
    }

    let foundCandidates = [];

    console.time('getUserWardPhrase');
    const { wardPhrase: userInputWardPhrase, higherAdminPhrase: identifiedHigherAdminPhrase, isWardPhraseExplicitlyPrefixed: isUserInputWardPhraseExplicitlyPrefixed } = getUserWardPhrase(normalizedUserInput);
    console.timeEnd('getUserWardPhrase');

    if (DEBUG_MODE) {
        console.log("Trích xuất cụm từ phường từ input (userInputWardPhrase):", userInputWardPhrase);
        console.log("Cụm từ hành chính cấp cao được xác định bởi getUserWardPhrase:", identifiedHigherAdminPhrase);
        console.log("Cụm từ phường của người dùng có được tiền tố rõ ràng không:", isUserInputWardPhraseExplicitlyPrefixed);
    }

    let identifiedExplicitHigherAdminInInput = new Set();
    const sortedHigherAdminNames = Array.from(allCleanedAdminNames.allHigherAdmin).sort((a, b) => b.length - a.length);

    for (const adminName of sortedHigherAdminNames) {
        for (const prefix of higherAdminPrefixesWords) {
            const prefixedAdminName = `${prefix} ${adminName}`;
            if (testPhraseWithWordBoundaries(normalizedUserInput, prefixedAdminName)) {
                identifiedExplicitHigherAdminInInput.add(adminName);
                break; // Found with a prefix, move to next adminName
            }
        }
        // Also check if the higher admin name is present in input AND it's a known district/province, even without a prefix
        if ((allCleanedAdminNames.districts.has(adminName) || allCleanedAdminNames.provinces.has(adminName)) &&
            testPhraseWithWordBoundaries(normalizedUserInput, adminName)) {
            identifiedExplicitHigherAdminInInput.add(adminName);
        }
    }
    if (DEBUG_MODE) {
        console.log("Các cụm từ hành chính cấp cao được xác định rõ ràng trong input:", Array.from(identifiedExplicitHigherAdminInInput));
    }

    let dataToProcessForScoring = [];
    // <<< CHỈNH SỬA TẠI ĐÂY: Logic lọc dataToProcessForScoring để ưu tiên ngữ cảnh hành chính cấp cao
    if (userInputWardPhrase && allCleanedAdminNames.wards.has(getCleanAddressName(userInputWardPhrase))) {
        // Start with candidates directly matching the identified ward phrase (e.g., "ea tling")
        const cleanUserInputWardPhrase = getCleanAddressName(userInputWardPhrase);
        dataToProcessForScoring = Array.from(allCleanedAdminNames.wards.get(cleanUserInputWardPhrase) || []);

        if (identifiedExplicitHigherAdminInInput.size > 0) {
            // Further filter these candidates by consistency with higher admin context
            dataToProcessForScoring = dataToProcessForScoring.filter(item => {
                const normalizedItemDistrict = normalizeString(getCleanAddressName(item.district));
                const normalizedItemProvince = normalizeString(getCleanAddressName(item.province));
                let consistent = false;
                for (const explicitAdmin of identifiedExplicitHigherAdminInInput) {
                    if ((normalizedItemDistrict && (testPhraseWithWordBoundaries(normalizedItemDistrict, explicitAdmin) || testPhraseWithWordBoundaries(explicitAdmin, normalizedItemDistrict))) ||
                        (normalizedItemProvince && (testPhraseWithWordBoundaries(normalizedItemProvince, explicitAdmin) || testPhraseWithWordBoundaries(explicitAdmin, normalizedItemProvince)))) {
                        consistent = true;
                        break;
                    }
                }
                return consistent;
            });

            if (dataToProcessForScoring.length === 0) {
                // If filtering by higher admin yielded no results, fall back to just the ward phrase matches (less strict)
                dataToProcessForScoring = Array.from(allCleanedAdminNames.wards.get(cleanUserInputWardPhrase) || []);
            }

            if (DEBUG_MODE) {
                console.log(`Đã lọc dataToProcessForScoring xuống ${dataToProcessForScoring.length} mục dựa trên userInputWardPhrase và higher admin consistency.`);
            }
        }
    }

    if (dataToProcessForScoring.length === 0 && identifiedExplicitHigherAdminInInput.size > 0) {
        // If no clear ward, but strong higher admin, filter entire addressData
        dataToProcessForScoring = addressData.filter(item => {
            const normalizedItemDistrict = normalizeString(getCleanAddressName(item.district));
            const normalizedItemProvince = normalizeString(getCleanAddressName(item.province));
            let consistent = false;
            for (const explicitAdmin of identifiedExplicitHigherAdminInInput) {
                if ((normalizedItemDistrict && (testPhraseWithWordBoundaries(normalizedItemDistrict, explicitAdmin) || testPhraseWithWordBoundaries(explicitAdmin, normalizedItemDistrict))) ||
                    (normalizedItemProvince && (testPhraseWithWordBoundaries(normalizedItemProvince, explicitAdmin) || testPhraseWithWordBoundaries(explicitAdmin, normalizedItemProvince)))) {
                    consistent = true;
                    break;
                }
            }
            return consistent;
        });
        if (DEBUG_MODE) {
            console.log(`Đã lọc dataToProcessForScoring xuống ${dataToProcessForScoring.length} mục dựa trên higher admin ONLY.`);
        }
    }

    if (dataToProcessForScoring.length === 0) {
        dataToProcessForScoring = addressData; // Fallback to full scan if nothing was explicitly filtered
        if (DEBUG_MODE) {
            console.log("Không tìm thấy cụm từ phường hoặc cấp cao rõ ràng. Đang duyệt toàn bộ addressData.");
        }
    }
    // >>> HẾT PHẦN CHỈNH SỬA


    console.time('scoringLoop');
    for (const item of dataToProcessForScoring) {
        let score = 0; // This is the main score variable for the current item
        let isWardMatch = false;
        let isDistrictMatch = false;
        let isProvinceMatch = false;
        let exactCoreWardMatch = false;
        let matchedCoreWords = new Set();

        const cleanWardNameInDB = getCleanAddressName(item.ward);
        const normalizedDistrictInDB = normalizeString(item.district);
        const cleanedDistrictNameInDB = getCleanAddressName(item.district);
        const normalizedProvinceInDB = normalizeString(item.province);
        const cleanedProvinceNameInDB = getCleanAddressName(item.province);
        const normalizedItemProvince = normalizeString(item.province);
        const normalizedItemDistrict = normalizeString(item.district);


        if (userInputWardPhrase && cleanWardNameInDB === getCleanAddressName(userInputWardPhrase)) {
            if (testPhraseWithWordBoundaries(normalizedUserInput, getCleanAddressName(userInputWardPhrase))) {
                score += 200000000; // Very high for direct, exact ward match from getUserWardPhrase
                isWardMatch = true;
                exactCoreWardMatch = true;
            }
        }

        if (!isWardMatch && testPhraseWithWordBoundaries(normalizedUserInput, cleanWardNameInDB) && cleanWardNameInDB.length > 0) {
            score += 150000000; // High for general ward name match
            isWardMatch = true;
            if (cleanWardNameInDB.split(/\s+/).filter(Boolean).length > 1) {
                score += 500000; // Bonus for multi-word ward
            }
        }

        if (identifiedHigherAdminPhrase) { // Only proceeds if a *strictly prefixed* higher admin was found by getUserWardPhrase
            const associatedItemsForWard = allCleanedAdminNames.wards.get(cleanWardNameInDB);
            let isWardConsistentWithHigherAdmin = false;
            if (associatedItemsForWard) {
                for (const itemOfWard of associatedItemsForWard) {
                    const normalizedItemOfWardDistrict = normalizeString(getCleanAddressName(itemOfWard.district));
                    const normalizedItemOfWardProvince = normalizeString(getCleanAddressName(itemOfWard.province));

                    if ((normalizedItemOfWardDistrict && (testPhraseWithWordBoundaries(identifiedHigherAdminPhrase, normalizedItemOfWardDistrict) || testPhraseWithWordBoundaries(normalizedItemOfWardDistrict, identifiedHigherAdminPhrase))) ||
                        (normalizedItemOfWardProvince && (testPhraseWithWordBoundaries(identifiedHigherAdminPhrase, normalizedItemOfWardProvince) || testPhraseWithWordBoundaries(normalizedItemOfWardProvince, identifiedHigherAdminPhrase)))) {
                        isWardConsistentWithHigherAdmin = true;
                        break;
                    }
                }
            }
            if (!isWardConsistentWithHigherAdmin && isWardMatch && !isUserInputWardPhraseExplicitlyPrefixed) {
                // Penalize if identified ward doesn't match the higher admin context and not explicitly prefixed
                score = Math.max(score - 5000000000, 0); // Very large penalty
                // isWardMatch = false; // May want to effectively disqualify if this penalty makes score zero
            } else if (isWardConsistentWithHigherAdmin && isWardMatch) {
                score += 100000000; // Bonus if consistent
            }
        }
        if (isUserInputWardPhraseExplicitlyPrefixed && isWardMatch && cleanWardNameInDB === getCleanAddressName(userInputWardPhrase)) {
            score += 50000000; // Huge bonus for explicit and exact ward match
        }

        if (!isWardMatch) { // Re-evaluate partial matching if no direct match was found
            const knownWardWords = cleanWardNameInDB.split(/\s+/).filter(Boolean);
            let bestContiguousPartialMatch = '';

            for (let i = 0; i < knownWardWords.length; i++) {
                for (let j = i; j < knownWardWords.length; j++) {
                    const currentContiguousPhrase = knownWardWords.slice(i, j + 1).join(' ');
                    if (currentContiguousPhrase.length > 0 && testPhraseWithWordBoundaries(normalizedUserInput, currentContiguousPhrase)) {
                        if (currentContiguousPhrase.length > bestContiguousPartialMatch.length) {
                            bestContiguousPartialMatch = currentContiguousPhrase;
                        }
                    }
                }
            }

            if (bestContiguousPartialMatch.length > 0) {
                score += bestContiguousPartialMatch.length * 5000; // Smaller bonus for partial match
                isWardMatch = true;
            }
        }
        if (isWardMatch && score >= 100) { // Add contextual bonus if a ward match exists
            const associatedItemsForWard = allCleanedAdminNames.wards.get(cleanWardNameInDB);
            if (associatedItemsForWard) {
                let bestContextualBonus = 0;
                for (const itemOfWard of associatedItemsForWard) {
                    let contextualBonus = 0;
                    const normalizedFullDistrict = normalizeString(itemOfWard.district);
                    const cleanedDistrict = normalizeString(getCleanAddressName(itemOfWard.district));
                    const normalizedFullProvince = normalizeString(getCleanAddressName(itemOfWard.province));
                    const cleanedProvince = normalizeString(getCleanAddressName(itemOfWard.province));

                    const districtMatch = (normalizedFullDistrict && (testPhraseWithWordBoundaries(normalizedUserInput, normalizedFullDistrict) || testPhraseWithWordBoundaries(normalizedFullDistrict, normalizedUserInput))) ||
                        (cleanedDistrict && (testPhraseWithWordBoundaries(normalizedUserInput, cleanedDistrict) || testPhraseWithWordBoundaries(cleanedDistrict, normalizedUserInput)));
                    const provinceMatch = (normalizedFullProvince && (testPhraseWithWordBoundaries(normalizedUserInput, normalizedFullProvince) || testPhraseWithWordBoundaries(normalizedFullProvince, normalizedUserInput))) ||
                        (cleanedProvince && (testPhraseWithWordBoundaries(normalizedUserInput, cleanedProvince) || testPhraseWithWordBoundaries(cleanedProvince, normalizedUserInput)));
                    if (districtMatch) {
                        contextualBonus += 10000;
                    }
                    if (provinceMatch) {
                        contextualBonus += 20000;
                    }
                    bestContextualBonus = Math.max(bestContextualBonus, contextualBonus);
                }
                score += bestContextualBonus; // FIX: Changed currentScore to score
            }
            if (cleanWardNameInDB.split(/\s+/).filter(Boolean).length > 1) {
                score += 5000;
            }
        }

        let districtStrictMatch = false;
        let districtPartialMatch = false;

        if ((normalizedDistrictInDB && testPhraseWithWordBoundaries(normalizedUserInput, normalizedDistrictInDB)) ||
            (cleanedDistrictNameInDB && testPhraseWithWordBoundaries(normalizedUserInput, cleanedDistrictNameInDB))) {
            districtStrictMatch = true;
        }

        if (!districtStrictMatch && normalizedDistrictInDB) {
            const coreUserInputForDistrict = getCoreNameForMatch(normalizedUserInput);
            const coreDBDistrict = getCoreNameForMatch(normalizedItemDistrict);

            if (coreUserInputForDistrict && coreDBDistrict &&
                (coreDBDistrict.includes(coreUserInputForDistrict) || coreUserInputForDistrict.includes(coreDBDistrict))) {
                districtPartialMatch = true;
            } else {
                const userInputWordsForDistrict = userInputCoreWords;
                const dbDistrictWords = normalizedItemDistrict.split(/\s+/).filter(Boolean);

                const commonWords = userInputWordsForDistrict.filter(uw => dbDistrictWords.includes(uw));
                if (commonWords.length > 0) {
                    districtPartialMatch = true;
                }
            }
        }

        if (districtStrictMatch || districtPartialMatch) {
            isDistrictMatch = true;
            if (districtStrictMatch) {
                score += 10000000;
            } else {
                score += 5000000;
            }
            if (isWardMatch) {
                score += 20000000; // Bonus for ward + district match
            }
        }

        let provinceStrictMatch = false;
        let provincePartialMatch = false;

        if ((normalizedProvinceInDB && testPhraseWithWordBoundaries(normalizedUserInput, normalizedProvinceInDB)) ||
            (cleanedProvinceNameInDB && testPhraseWithWordBoundaries(normalizedUserInput, cleanedProvinceNameInDB))) {
            provinceStrictMatch = true;
        }

        if (!provinceStrictMatch && normalizedProvinceInDB) {
            const coreUserInputForProvince = getCoreNameForMatch(normalizedUserInput);
            const coreDBProvince = getCoreNameForMatch(normalizedItemProvince);

            if (coreUserInputForProvince && coreDBProvince &&
                (coreDBProvince.includes(coreUserInputForProvince) || coreUserInputForProvince.includes(coreDBProvince))) {
                provincePartialMatch = true;
            } else {
                const userInputWordsForProvince = userInputCoreWords;
                const dbProvinceWords = normalizedItemProvince.split(/\s+/).filter(Boolean);
                const commonWords = userInputWordsForProvince.filter(uw => dbProvinceWords.includes(uw));
                if (commonWords.length > 0) {
                    provincePartialMatch = true;
                }
            }
        }

        if (provinceStrictMatch || provincePartialMatch) {
            isProvinceMatch = true;
            if (provinceStrictMatch) {
                score += 15000000;
            } else {
                score += 7000000;
            }
            if (isWardMatch) {
                score += 30000000; // Bonus for ward + province match
            }
        }

        // Count matched core words
        userInputCoreWords.forEach(inputWord => {
            if (testPhraseWithWordBoundaries(cleanWardNameInDB, inputWord)) {
                matchedCoreWords.add(inputWord);
            }
            if (testPhraseWithWordBoundaries(cleanedDistrictNameInDB, inputWord)) {
                matchedCoreWords.add(inputWord);
            }
            if (testPhraseWithWordBoundaries(cleanedProvinceNameInDB, inputWord)) {
                matchedCoreWords.add(inputWord);
            }
        });
        let matchedCoreWordsCount = matchedCoreWords.size;
        score += matchedCoreWordsCount * 10000; // Bonus for each unique core word matched

        // Combine match bonuses
        if (isDistrictMatch && isProvinceMatch) {
            score += 60000000; // Bonus for district + province match
        }
        if (exactCoreWardMatch && districtStrictMatch && provinceStrictMatch) {
            score += 300000000; // Super bonus for full exact match
        } else if (isWardMatch && isDistrictMatch && isProvinceMatch) {
            score += 100000000; // Large bonus for general full match
        } else if (isWardMatch && isDistrictMatch) {
            score += 50000000; // Significant bonus for ward + district
        }


        let contextMatchesCandidateDistrict = false;
        let contextMatchesCandidateProvince = false;

        for (const explicitAdmin of identifiedExplicitHigherAdminInInput) {
            if (normalizedItemDistrict && (testPhraseWithWordBoundaries(normalizedItemDistrict, explicitAdmin) || testPhraseWithWordBoundaries(explicitAdmin, normalizedItemDistrict))) {
                contextMatchesCandidateDistrict = true;
            }
            if (normalizedItemProvince && (testPhraseWithWordBoundaries(normalizedItemProvince, explicitAdmin) || testPhraseWithWordBoundaries(explicitAdmin, normalizedItemProvince))) {
                contextMatchesCandidateProvince = true;
            }
        }

        // <<< CHỈNH SỬA TẠI ĐÂY: Tăng điểm thưởng cho Higher Admin Matches và áp dụng phạt nếu không khớp
        let hasStrongHigherAdminMatch = false;

        if (identifiedExplicitHigherAdminInInput.size > 0) {
            for (const explicitAdmin of identifiedExplicitHigherAdminInInput) {
                // Strong bonus if the explicit higher admin is found directly within the candidate's district or province
                if ((normalizedItemDistrict && testPhraseWithWordBoundaries(normalizedItemDistrict, explicitAdmin)) ||
                    (normalizedItemProvince && testPhraseWithWordBoundaries(normalizedItemProvince, explicitAdmin))) {
                    score += 1500000000; // Super high bonus for direct contextual match
                    hasStrongHigherAdminMatch = true;
                    break;
                }
            }

            // More nuanced penalty: if *any* higher admin was identified in input, but *this candidate* doesn't match *any* of them strongly, penalize.
            // But only if there is a district/province in the candidate to check against.
            if (!hasStrongHigherAdminMatch && (normalizedItemDistrict || normalizedItemProvince)) {
                score = Math.max(score - 500000000, 0); // Significant, but not score-zeroing penalty
            }
        }
        // >>> HẾT PHẦN CHỈNH SỬA

        // Slight penalty if getUserWardPhrase couldn't find a strong ward, but we still found a ward match here
        if (!userInputWardPhrase && isWardMatch) {
            score -= 1000;
        }

        // Penalize overly generic ward names if input is long (implies specific address)
        const genericWardNames = ['phuong', 'xa', 'thi tran'];
        if (genericWardNames.includes(cleanWardNameInDB) && normalizedUserInput.length > 10) {
            score -= 500;
        }

        foundCandidates.push({
            item: item,
            score: score,
            isWardMatch: isWardMatch,
            isDistrictMatch: isDistrictMatch,
            isProvinceMatch: isProvinceMatch,
            exactCoreWardMatch: exactCoreWardMatch,
            exactCoreDistrictMatch: districtStrictMatch,
            exactCoreProvinceMatch: provinceStrictMatch,
            matchedCoreWordsCount: matchedCoreWordsCount
        });
    }
    console.timeEnd('scoringLoop');


    console.time('sortCandidates');
    foundCandidates.sort((a, b) => {
        if (b.score !== a.score) {
            return b.score - a.score;
        }
        if (a.exactCoreWardMatch !== b.exactCoreWardMatch) {
            return b.exactCoreWardMatch - a.exactCoreWardMatch;
        }
        if (a.exactCoreDistrictMatch !== b.exactCoreDistrictMatch) {
            return b.exactCoreDistrictMatch - a.exactCoreDistrictMatch;
        }
        if (a.exactCoreProvinceMatch !== b.exactCoreProvinceMatch) {
            return b.exactCoreProvinceMatch - a.exactCoreProvinceMatch;
        }
        if (b.matchedCoreWordsCount !== a.matchedCoreWordsCount) {
            return b.matchedCoreWordsCount - a.matchedCoreWordsCount;
        }
        // Prioritize full matches (ward, district, province)
        const aFullGeneralMatch = a.isWardMatch && a.isDistrictMatch && a.isProvinceMatch;
        const bFullGeneralMatch = b.isWardMatch && b.isDistrictMatch && b.isProvinceMatch;
        if (aFullGeneralMatch !== bFullGeneralMatch) {
            return bFullGeneralMatch - aFullGeneralMatch;
        }
        // Then prioritize matches with more administrative levels
        const aMatchedCount = (a.isWardMatch ? 1 : 0) + (a.isDistrictMatch ? 1 : 0) + (a.isProvinceMatch ? 1 : 0);
        const bMatchedCount = (b.isWardMatch ? 1 : 0) + (b.isDistrictMatch ? 1 : 0) + (b.isProvinceMatch ? 1 : 0);
        if (aMatchedCount !== bMatchedCount) {
            return bMatchedCount - aMatchedCount;
        }
        return a.item.ward.localeCompare(b.item.ward);
    });
    console.timeEnd('sortCandidates');


    if (DEBUG_MODE) {
        console.log("\nCác ứng cử viên tìm được (đã sắp xếp):");
        foundCandidates.slice(0, 5).forEach(c => {
            console.log(`- ${c.item.ward}, ${c.item.district}, ${c.item.province} | Score: ${c.score} | Exact: W:${c.exactCoreWardMatch} D:${c.exactCoreDistrictMatch} P:${c.exactCoreProvinceMatch} | General: W:${c.isWardMatch} D:${c.isDistrictMatch} P:${c.isProvinceMatch} | CoreWords: ${c.matchedCoreWordsCount}`);
        });
        if (foundCandidates.length > 5) {
            console.log(`... và ${foundCandidates.length - 5} ứng cử viên khác.`);
        }
    }


    let finalResults = [];
    if (foundCandidates.length > 0) {
        let topScore = foundCandidates[0].score;
        finalResults = foundCandidates.filter(c => c.score === topScore);
    }

    let finalResultsFiltered = [...finalResults];

    // Refinement for multiple candidates with the same top score
    if (finalResultsFiltered.length > 1) {
        let mostRefinedCandidates = [];
        let maxRefinementScore = -1;

        for (const candidate of finalResultsFiltered) {
            let currentRefinementScore = 0;
            const candidateCleanWardName = getCleanAddressName(candidate.item.ward);
            const candidateCleanDistrictName = normalizeString(getCleanAddressName(candidate.item.district));
            const candidateCleanProvinceName = normalizeString(getCleanAddressName(candidate.item.province));

            if (userInputWardPhrase && candidateCleanWardName === getCleanAddressName(userInputWardPhrase)) {
                currentRefinementScore += 1000; // Exact match with the phrase identified by getUserWardPhrase
            } else if (userInputWardPhrase && testPhraseWithWordBoundaries(candidateCleanWardName, getCleanAddressName(userInputWardPhrase))) {
                currentRefinementScore += 100; // Partial match with the phrase identified by getUserWardPhrase
            }

            // *** ADD/MODIFY THIS SECTION ***
            // Strong bonus if the candidate's district/province matches the higherAdminPhrase identified
            if (identifiedHigherAdminPhrase) {
                if ((candidateCleanDistrictName && testPhraseWithWordBoundaries(identifiedHigherAdminPhrase, candidateCleanDistrictName)) ||
                    (candidateCleanDistrictName && testPhraseWithWordBoundaries(candidateCleanDistrictName, identifiedHigherAdminPhrase))) {
                    currentRefinementScore += 5000; // High bonus for district consistency
                }
                if ((candidateCleanProvinceName && testPhraseWithWordBoundaries(identifiedHigherAdminPhrase, candidateCleanProvinceName)) ||
                    (candidateCleanProvinceName && testPhraseWithWordBoundaries(candidateCleanProvinceName, identifiedHigherAdminPhrase))) {
                    currentRefinementScore += 7000; // Higher bonus for province consistency
                }
            }
            // *** END ADD/MODIFY SECTION ***


            const districtMatchConfidence = testPhraseWithWordBoundaries(normalizedUserInput, candidateCleanDistrictName);
            const provinceMatchConfidence = testPhraseWithWordBoundaries(normalizedUserInput, candidateCleanProvinceName) || testPhraseWithWordBoundaries(normalizedUserInput, 'ho chi minh');

            if (districtMatchConfidence) {
                currentRefinementScore += 500;
            }
            if (provinceMatchConfidence) {
                currentRefinementScore += 700;
            }

            // Bonus for multi-word wards if it exactly matches the user input ward phrase
            if (candidateCleanWardName.split(/\s+/).filter(Boolean).length > 1 && candidateCleanWardName === getCleanAddressName(userInputWardPhrase)) {
                currentRefinementScore += 200;
            }
            currentRefinementScore += (candidate.exactCoreWardMatch ? 1 : 0) * 10;
            currentRefinementScore += (candidate.exactCoreDistrictMatch ? 1 : 0) * 5;
            currentRefinementScore += (candidate.exactCoreProvinceMatch ? 1 : 0) * 3;


            if (currentRefinementScore > maxRefinementScore) {
                maxRefinementScore = currentRefinementScore;
                mostRefinedCandidates = [candidate];
            }
            else if (currentRefinementScore === maxRefinementScore) {
                mostRefinedCandidates.push(candidate);
            }
        }
        finalResultsFiltered = mostRefinedCandidates;
    }

    if (finalResultsFiltered.length > 1) {
        // If still multiple, pick the one that matches more segments (ward, district, province)
        finalResultsFiltered.sort((a, b) => {
            const aSegments = (a.isWardMatch ? 1 : 0) + (a.isDistrictMatch ? 1 : 0) + (a.isProvinceMatch ? 1 : 0);
            const bSegments = (b.isWardMatch ? 1 : 0) + (b.isDistrictMatch ? 1 : 0) + (b.isProvinceMatch ? 1 : 0);
            if (aSegments !== bSegments) {
                return bSegments - aSegments;
            }
            // Fallback to alphabetical if still tied
            return a.item.ward.localeCompare(b.item.ward);
        });
        finalResultsFiltered = finalResultsFiltered.filter((_, index) => index === 0); // Keep only the first best match
    }


    let resultMessage = '';
    let warningMessage = undefined;

    if (finalResultsFiltered.length > 0) {
        resultMessage = `Tìm thấy ${finalResultsFiltered.length} kết quả phù hợp nhất.`;
    } else {
        resultMessage = 'Không tìm thấy địa chỉ phù hợp nào. Vui lòng kiểm tra lại thông tin nhập vào.';
        warningMessage = 'No matching address found.';
    }

    const outputResults = finalResultsFiltered.map(c => ({
        ward: c.item.ward,
        district: c.item.district,
        city: c.item.province,
        newprov: c.item.newprov,
        newward: c.item.newward,
        fullnew: c.item.fullnew
    }));

    if (DEBUG_MODE) {
        console.log("\nKết quả trả về cho người dùng (Final):", {
            success: outputResults.length > 0,
            results: outputResults,
            message: resultMessage,
            warning: warningMessage
        });
        console.log("--- Kết thúc xử lý yêu cầu mới ---\n");
    }

    console.timeEnd('processAddress');
    res.json({
        success: outputResults.length > 0,
        results: outputResults,
        message: resultMessage,
        warning: warningMessage
    });
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});