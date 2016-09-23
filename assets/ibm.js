'use strict';

// define a couple global helper methods to get rid of some boilerplate

/**
 * wrapper around document.querySelector
 * @param selector
 * @returns {Element}
 */
function $(selector) {
    return document.querySelector(selector);
}

/**
 * return array of all elements returned by document.querySelectorAll
 * @param selector
 * @returns {Array}
 */
function $$(selector) {
    var elements = {
        nodeList: document.querySelectorAll(selector),
        arr: []
    };

    for (var i = 0; i < elements.nodeList.length; i++) {
        elements.arr.push(elements.nodeList[i]);
    }

    return elements.arr;
}

function noop() {}

HTMLElement.prototype.on = HTMLElement.prototype.addEventListener;
HTMLElement.prototype.find = HTMLElement.prototype.querySelector;

var ibm = window.ibm || {};
ibm = {
    flickr: {
        baseUrl: 'https://api.flickr.com/services/rest/',
        options: {
            method: 'flickr.people.getPublicPhotos',
            api_key: 'a5e95177da353f58113fd60296e1d250',
            user_id: '24662369@N07',
            format: 'json',
            nojsoncallback: 1,
            extras: 'date_upload,date_taken,geo,views'
        },

        getEndpoint: function () {
            return this.baseUrl + '?' + ibm.utils.toQueryString(this.options);
        }
    },

    init: function () {
        this.getPhotos();
        this.streamControls();

        $$('.cycle-photo').forEach(function (el) {
            el.on('click', function () {
                var visibleElements = $$('.photo-wrapper').filter(function (el) {
                    return !el.classList.contains('stream-hidden');
                });

                var currentIndex = parseInt($('.active-controls').dataset.index, 10);
                var delta = parseInt(this.dataset.delta, 10);

                var nextIndex = (currentIndex + delta) % visibleElements.length;
                if (nextIndex < 0)
                    nextIndex = visibleElements.length - 1;

                var nextWrapper = $('.photo-wrapper[data-index="' + nextIndex + '"]');

                ibm.makePhotoActive(nextWrapper);
            }, false);
        });

        $('#close-active').on('click', function () {
            $('#active-container').style.display = 'none';
            ibm.utils.removeClassAll('active-wrapper');
        }, false);
    },

    getPhotos: function () {
        var endpoint = this.flickr.getEndpoint();

        ibm.utils.get(endpoint, {
            success: function (res) {
                var data = JSON.parse(res);
                if (!data || data.stat !== 'ok') {
                    return alert('An error occurred.');
                }

                var photos = data.photos.photo.map(function (p) {
                    return {
                        id: p.id,
                        standard: 'https://farm' + p.farm + '.staticflickr.com/' + p.server + '/' + p.id + '_' + p.secret + '.jpg',
                        hiRes: 'https://farm' + p.farm + '.staticflickr.com/' + p.server + '/' + p.id + '_' + p.secret + '_b.jpg',
                        title: p.title,
                        dateTaken: p.datetaken,
                        views: p.views
                    };
                });

                ibm.attachPhotosToDom(photos);
            },
            error: function (msg) {
                alert(msg);
            }
        });
    },

    // for each photo object in the collection add image properties as data-* attributes to the wrapper
    // so we can sort/filter later
    attachPhotosToDom: function (photoCollection) {
        var photoListEl = $('#photo-list');
        photoCollection.forEach(function (p, index) {
            var wrapper = ibm.createPhotoWrapper(p, index);
            var title = ibm.createPhotoTitle(p.title);

            var img = new Image();
            img.src = p.standard;
            img.classList.add('photo-item');
            img.onload = function () {
                img.classList.add('loaded');

                if (img.width > img.height) {
                    wrapper.classList.add('wider');
                }
                else {
                    wrapper.classList.add('taller');
                }
            };

            wrapper.appendChild(img);
            wrapper.appendChild(title);
            photoListEl.appendChild(wrapper);
        });

        ibm.checkStreamContainerWidth();
        ibm.photoListeners();
    },

    // this method should only be called when the photos are loaded the first time, see comment below for details
    createPhotoWrapper: function (photo, index) {
        var wrapper = document.createElement('div');
        wrapper.classList.add('photo-wrapper');
        wrapper.dataset.url = photo.standard;
        wrapper.dataset.title = photo.title;
        wrapper.dataset.views = photo.views;
        wrapper.dataset.id = photo.id;
        wrapper.dataset.dateTaken = photo.dateTaken.split(' ')[0];

        // add index twice so we can restore index and still cycle through
        // the images in order in the lightbox
        wrapper.dataset.index = wrapper.dataset.initIndex = index;

        return wrapper;
    },

    createPhotoTitle: function (title) {
        var el = document.createElement('span');
        el.classList.add('photo-info');
        el.textContent = title;

        return el;
    },

    photoListeners: function () {
        $$('.photo-wrapper').forEach(function (wrapper) {
            var img = wrapper.find('img.photo-item');

            img.on('click', function () {
                ibm.makePhotoActive(wrapper);
            }, false);
        });
    },

    makePhotoActive: function (wrapper) {
        if (wrapper === void 0) { return; }
        var activeContainer = $('#active-container');

        ibm.utils.removeClassAll('active-wrapper');
        wrapper.classList.add('active-wrapper');

        var activePhoto = activeContainer.find('#active-photo');

        activeContainer.find('#title').textContent = wrapper.dataset.title;
        activeContainer.find('#date-taken').textContent = wrapper.dataset.dateTaken;
        activeContainer.find('#views').textContent = wrapper.dataset.views;
        activeContainer.style.display = 'block';
        activeContainer.find('.active-controls').dataset.index = wrapper.dataset.index;

        var hiRes = new Image();
        hiRes.classList.add('hi-res');
        hiRes.src = wrapper.dataset.url;
        hiRes.onload = function () {
            activePhoto.innerHTML = '';
            activePhoto.appendChild(hiRes);
            hiRes.classList.add('loaded');
        };
    },

    streamControls: function () {
        $('#stream-search').on('click', function () {
            var searchBar = $('#search-term');
            var term = searchBar.value;

            ibm.filterPhotosByTitle(term);
            $('#reset-stream').style.display = 'block';
        }, false);

        $('#search-term').on('keypress', function (e) {
            var keyCode = e.which || e.keyCode;
            if (parseInt(keyCode) === 13) {
                ibm.filterPhotosByTitle(this.value);
                $('#reset-stream').style.display = 'block';
            }
        }, false);

        $('#stream-sorts').on('change', function () {
            var option = this.find('[value="' + this.value + '"]');
            ibm.sortPhotos(option.dataset.attribute, option.dataset.sort);
            $('#reset-stream').style.display = 'block';
        }, false);

        $('#reset-stream').on('click', function () {
            ibm.resetStream();
        }, false);
    },

    getPhotoList: function () {
        return $$('.photo-wrapper').map(function (p) {
            return {
                id: p.dataset.id,
                url: p.dataset.url,
                title: p.dataset.title,
                dateTaken: p.dataset.dateTaken,
                views: p.dataset.views,
                index: p.dataset.initIndex,
                el: p
            };
        });
    },

    sortPhotos: function (attribute, sortDir) {
        var list = this.getPhotoList();

        var sorted = null;
        // should be able to make this much more scable by plugging attribute in (a[attribute])
        if (attribute === 'dateTaken') {
            sorted = list.sort(function (a, b) {
                var aMS = Date.parse(a.dateTaken);
                var bMS = Date.parse(b.dateTaken);
                if (sortDir === 'asc')
                    return aMS - bMS;
                else
                    return bMS - aMS;
            });
        }
        else {
            sorted = list.sort(function (a, b) {
                if (sortDir === 'asc')
                    return a[attribute] - b[attribute];
                else
                    return b[attribute] - a[attribute];
            });
        }

        this.appendFilteredPhotos(sorted);
    },

    filterPhotosByTitle: function (searchText) {
        ibm.resetStream(true);

        var regex = new RegExp(searchText, 'gi');

        var photoList = this.getPhotoList();
        var visibleIndex = 0;
        photoList.forEach(function (p) {
            if (!regex.test(p.title)) {
                p.el.classList.add('stream-hidden');
                p.el.dataset.index = '';
            }
            else {
                p.el.dataset.index = visibleIndex++;
            }
        });
    },

    appendFilteredPhotos: function (photoArray) {
        var photoListEl = $('#photo-list');
        photoListEl.innerHTML = '';
        photoArray.forEach(function (p, index) {
            p.el.dataset.index = index;
            photoListEl.appendChild(p.el);
        });
    },

    resetStream: function (preserveTerm) {
        ibm.utils.removeClassAll('stream-hidden');
        ibm.sortPhotos('index', 'asc');

        $('#reset-stream').style.display = 'none';
        $('#stream-sorts').value = -1;
        if (!preserveTerm)
            $('#search-term').value = '';
    },

    // check stream container width, if it's smaller than 400px we need to resize the photos
    // so we can fit two side by side.
    checkStreamContainerWidth: function () {
        var list = $('#photo-list');

        var rectData = list.getBoundingClientRect();
        if (rectData.width < 400) {
            var newEdgeLength = (rectData.width * 0.5) + 'px';
            $$('.photo-wrapper').forEach(function (wrap) {
                wrap.style.width = wrap.style.height = newEdgeLength;
            });
        }
    }
};

ibm.utils = {
    // IE doesn't support promises because of course not
    get: function (endpoint, options) {
        if (options === void 0) {
            options = { success: noop, error: noop, data: {} };
        }

        var req = new XMLHttpRequest();
        req.open('GET', endpoint);

        req.onload = function () {
            if (req.status < 400) {
                options.success(req.response);
            }
            else {
                options.error(req.statusText);
            }
        };
        req.onerror = function () {
            options.error("Something went wrong");
        };

        var data = ibm.utils.toQueryString(options.data);
        req.send(data);
    },

    toQueryString: function (obj) {
        if (typeof obj !== 'object' || Object.keys(obj).length === 0) {
            return '';
        }

        var qs = '';
        for (var key in obj) {
            var val = obj[key];

            if (!qs.length) {
                qs += encodeURIComponent(key) + '=' +  encodeURIComponent(val);
            }
            else {
                qs += '&' + encodeURIComponent(key) + '=' +  encodeURIComponent(val);
            }
        }

        return qs;
    },

    removeClassAll: function (className) {
        $$('.' + className).forEach(function (el) {
            el.classList.remove(className);
        });
    }
};

ibm.init();
