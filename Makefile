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
	install --directory $(DESTDIR)$(PREFIX)/share/psi
	$(foreach x,$(shell find data -type f),$(LF)\
		install --mode=644 -D $(x) $(DESTDIR)$(PREFIX)/share/psi/$(x))
	install --mode=644 -D --target-directory=$(DESTDIR)$(PREFIX)/lib/systemd/system psi.service 
	install --mode=644 -D --target-directory=$(DESTDIR)$(PREFIX)/lib/systemd/system psi.service 
	install --mode=755 -D --target-directory=$(DESTDIR)$(PREFIX)/bin build/psi


.PHONY: uninstall
uninstall:
	$(foreach x,$(shell find data -type f),$(LF)\
		-rm --force $(DESTDIR)$(PREFIX)/share/psi/$(x))
	$(foreach x,$(shell find data -type d | sort --reverse),$(LF)\
		-rm --force --dir $(DESTDIR)$(PREFIX)/share/psi/$(x))
	-rm --force $(DESTDIR)$(PREFIX)/lib/systemd/system/psi.service 
	-rm --force $(DESTDIR)$(PREFIX)/bin/psi
