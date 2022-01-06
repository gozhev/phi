include make.mk/make.mk

$.go = go build

$(go_binary)
	name = psi
	srcs = main.go
$;

DESTDIR ?=
PREFIX ?= /usr/local

.PHONY: install
install:
	install --mode=644 -D --target-directory=$(DESTDIR)$(PREFIX)/lib/systemd/system psi.service 
	install --mode=755 -D --target-directory=$(DESTDIR)$(PREFIX)/bin build/psi

.PHONY: uninstall
uninstall:
	-rm --force $(DESTDIR)$(PREFIX)/lib/systemd/system/psi.service 
	-rm --force $(DESTDIR)$(PREFIX)/bin/psi
