(function($) {
    /** global: Craft */
    Craft.UpdatesPage = Garnish.Base.extend(
        {
            totalAvailableUpdates: 0,
            criticalUpdateAvailable: false,
            allowAutoUpdates: null,

            init: function(settings) {
                this.setSettings(settings, Craft.UpdatesPage.defaults);

                var $graphic = $('#graphic'),
                    $status = $('#status');

                Craft.postActionRequest('update/get-available-updates', $.proxy(function(response, textStatus) {
                    if (textStatus != 'success' || response.error || response.errors) {
                        var error = Craft.t('app', 'An unknown error occurred.');

                        if (response.errors && response.errors.length) {
                            error = response.errors[0];
                        }
                        else if (response.error) {
                            error = response.error;
                        }

                        $graphic.addClass('error');
                        $status.text(error);
                    }
                    else {
                        this.allowAutoUpdates = response.allowAutoUpdates;

                        // Craft CMS update?
                        if (response.app) {
                            this.processUpdate(response.app, false);
                        }

                        // Plugin updates?
                        if (response.plugins && response.plugins.length) {
                            for (var i = 0; i < response.plugins.length; i++) {
                                this.processUpdate(response.plugins[i], true);
                            }
                        }

                        if (this.totalAvailableUpdates) {
                            $graphic.remove();
                            $status.remove();

                            // Add the page title
                            var headingText;

                            if (this.totalAvailableUpdates == 1) {
                                headingText = Craft.t('app', '1 update available');
                            }
                            else {
                                headingText = Craft.t('app', '{num} updates available', {num: this.totalAvailableUpdates});
                            }

                            $('<div id="page-title"/>')
                                .appendTo(Craft.cp.$pageHeader)
                                .append($('<h1/>').text(headingText));

                        } else {
                            $graphic.addClass('success');
                            $status.text(Craft.t('app', 'You’re all up-to-date!'));
                        }
                    }
                }, this));
            },

            processUpdate: function(updateInfo, isPlugin) {
                if (!updateInfo.releases || !updateInfo.releases.length) {
                    return;
                }

                this.totalAvailableUpdates++;

                new Update(this, updateInfo, isPlugin);
            }
        },
        {
            defaults: {
                isComposerInstall: false
            }
        });


    var Update = Garnish.Base.extend(
        {
            updateInfo: null,
            isPlugin: null,
            displayName: null,
            manualUpdateRequired: null,

            $pane: null,
            $paneHeader: null,
            $downloadBtn: null,

            licenseHud: null,
            $licenseSubmitBtn: null,
            licenseSubmitAction: null,

            init: function(updatesPage, updateInfo, isPlugin) {
                this.updatesPage = updatesPage;
                this.updateInfo = updateInfo;
                this.isPlugin = isPlugin;
                this.displayName = this.isPlugin ? this.updateInfo.displayName : 'Craft CMS';
                this.manualUpdateRequired = (!this.updatesPage.allowAutoUpdates || this.updateInfo.manualUpdateRequired);

                this.createPane();
                this.createHeading();
                this.createDownloadButton();
                this.createReleaseList();
            },

            createPane: function() {
                this.$pane = $('<div class="pane update"/>').appendTo(Craft.cp.$main);
                this.$paneHeader = $('<div class="header"/>').appendTo(this.$pane);
            },

            createHeading: function() {
                $('<h1/>', {'class': 'left', text: this.displayName}).appendTo(this.$paneHeader);
            },

            createDownloadButton: function() {
                var $buttonContainer = $('<div class="buttons right"/>').appendTo(this.$paneHeader),
                    $updateBtn;

                // Are auto updates disabled because this is a Composer install?
                if (this.updatesPage.settings.isComposerInstall) {
                    $('<div class="btn submit disabled" title="' + Craft.t('app', 'Use Composer to get this update.') + '">' + Craft.t('app', 'Update') + '</div>').appendTo($buttonContainer);
                    return;
                }

                // Is a manual update required?
                if (this.manualUpdateRequired) {
                    this.$downloadBtn = $('<div class="btn submit">' + Craft.t('app', 'Download') + '</div>').appendTo($buttonContainer);
                }
                else {
                    var $btnGroup = $('<div class="btngroup submit"/>').appendTo($buttonContainer);

                    $updateBtn = $('<div class="btn submit">' + Craft.t('app', 'Update') + '</div>').appendTo($btnGroup);

                    var $menuBtn = $('<div class="btn submit menubtn"/>').appendTo($btnGroup),
                        $menu = $('<div class="menu" data-align="right"/>').appendTo($btnGroup),
                        $menuUl = $('<ul/>').appendTo($menu),
                        $downloadLi = $('<li/>').appendTo($menuUl);

                    this.$downloadBtn = $('<a>' + Craft.t('app', 'Download') + '</a>').appendTo($downloadLi);

                    new Garnish.MenuBtn($menuBtn);
                }

                // Has the license been updated?
                if (this.updateInfo.licenseUpdated) {
                    this.addListener(this.$downloadBtn, 'click', 'showLicenseForm');

                    if (!this.manualUpdateRequired) {
                        this.addListener($updateBtn, 'click', 'showLicenseForm');
                    }
                }
                else {
                    this.addListener(this.$downloadBtn, 'click', 'downloadThat');

                    if (!this.manualUpdateRequired) {
                        this.addListener($updateBtn, 'click', 'autoUpdateThat');
                    }
                }
            },

            createReleaseList: function() {
                for (var i = 0; i < this.updateInfo.releases.length; i++) {
                    new Release(this, this.updateInfo.releases[i]);
                }
            },

            showLicenseForm: function(originalEvent) {
                originalEvent.stopPropagation();

                if (!this.licenseHud) {
                    var $hudBody = $('<div><p>' + Craft.t('app', 'Craft’s <a href="http://craftcms.com/license" target="_blank">Terms and Conditions</a> have changed.') + '</p></div>'),
                        $label = $('<label> ' + Craft.t('app', 'I agree.') + ' &nbsp;</label>').appendTo($hudBody),
                        $checkbox = $('<input type="checkbox"/>').prependTo($label);

                    this.$licenseSubmitBtn = $('<input class="btn submit" type="submit"/>').appendTo($hudBody);

                    this.licenseHud = new Garnish.HUD(originalEvent.currentTarget, $hudBody, {
                        onSubmit: $.proxy(function() {
                            if ($checkbox.prop('checked')) {
                                this.licenseSubmitAction();
                                this.licenseHud.hide();
                                $checkbox.prop('checked', false);
                            }
                            else {
                                Garnish.shake(this.licenseHud.$hud);
                            }
                        }, this)
                    });
                }
                else {
                    this.licenseHud.$trigger = $(originalEvent.currentTarget);
                    this.licenseHud.show();
                }

                if (originalEvent.currentTarget == this.$downloadBtn[0]) {
                    this.$licenseSubmitBtn.attr('value', Craft.t('app', 'Seriously, download.'));
                    this.licenseSubmitAction = this.downloadThat;
                }
                else {
                    this.$licenseSubmitBtn.attr('value', Craft.t('app', 'Seriously, update.'));
                    this.licenseSubmitAction = this.autoUpdateThat;
                }
            },

            downloadThat: function() {
                window.location.href = this.updateInfo.manualDownloadEndpoint;
            },

            autoUpdateThat: function() {
                window.location.href = Craft.getUrl('updates/go/' + (this.isPlugin ? this.updateInfo.class.toLowerCase() : 'craft'));
            }
        });


    var Release = Garnish.Base.extend(
        {
            update: null,
            releaseInfo: null,

            $container: null,
            $releaseNotes: null,
            $showMoreLink: null,

            init: function(update, releaseInfo) {
                this.update = update;
                this.releaseInfo = releaseInfo;

                this.createContainer();
                this.createHeading();
                this.createReleaseNotes();
            },

            createContainer: function() {
                this.$container = $('<div class="release"/>').appendTo(this.update.$pane);
            },

            createHeading: function() {
                var heading = this.releaseInfo.version;

                if (this.releaseInfo.build) {
                    heading += '.' + this.releaseInfo.build;
                }

                if (this.releaseInfo.critical) {
                    heading += ' <span class="critical">' + Craft.t('app', 'Critical') + '</span>';
                }

                $('<h2/>', {html: heading}).appendTo(this.$container);
                $('<p/>', {'class': 'release-date light', text: Craft.t('app', 'Released on {date}', {date: Craft.formatDate(this.releaseInfo.date)})}).appendTo(this.$container);
            },

            createReleaseNotes: function() {
                this.$releaseNotes = $('<div class="release-notes"/>').appendTo(this.$container).html(this.releaseInfo.notes);

                var totalNotes = this.$releaseNotes.children('ul').children().length;

                if (totalNotes > Release.maxInitialReleaseNotes) {
                    this.$releaseNotes.addClass('fade-out');
                    this.$showMoreLink = $('<a/>', {'class': 'show-full-notes', text: Craft.t('app', 'Show more')}).appendTo(this.$container);
                    this.addListener(this.$showMoreLink, 'click', 'showMoreReleaseNotes');
                }
            },

            showMoreReleaseNotes: function() {
                var collapsedHeight = this.$releaseNotes.height();
                this.$releaseNotes.css('max-height', 'none');
                var expandedHeight = this.$releaseNotes.height();
                this.$releaseNotes
                    .height(collapsedHeight)
                    .velocity({height: expandedHeight}, {
                        duration: 'fast',
                        complete: $.proxy(function() {
                            this.$releaseNotes
                                .removeClass('fade-out')
                                .css('max-height', '');
                            this.$showMoreLink.remove();
                        }, this)
                    });

                this.$showMoreLink.velocity({opacity: 0, 'margin-top': -18}, {
                    duration: 'fast',
                    complete: $.proxy(function() {
                        this.$showMoreLink.remove();
                    })
                });
            }
        },
        {
            maxInitialReleaseNotes: 5
        });
})(jQuery);
