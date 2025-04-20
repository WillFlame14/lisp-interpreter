(defn pop [list] (__pop list))

(defn nth [list n] (__nth list n))

(defn cons [x list] (__cons x list))

(defn count [list] (__count list))

(defn print [x] (__print x))

(defn empty? [list] (__eq (count list) 0))

(defn first [list] (nth list 0))

(defn last [list] (nth list (__minus (count list) 1)))

(defn map [f list]
  (if (empty? list)
    list
    (cons (f (first list)) (map f (pop list)))))

(defn filter [f list]
  (if (empty? list)
    list
    (let [head (first list)
          rest (filter f (pop list))]
      (if (f head) 
        (cons head rest)
        rest))))

(defn reduce [f initial list]
  (if (empty? list) initial
    (reduce f (f initial (first list)) (pop list))))

(defn + [& args] (reduce __plus 0 args))

(defn = [& args] (reduce __eq true args))

(defn - [& args] (reduce __minus 0 args))

(defn not [x] (if x false true))

(defn concat [x y]
  (if (empty? x)
    y
    (cons (first x) (concat (pop x) y))))

(defn not= [x y] (not (= x y)))

(defn inc [x] (+ x 1))

(defn dec [x] (- x 1))